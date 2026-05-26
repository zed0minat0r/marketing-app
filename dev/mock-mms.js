'use strict';

/**
 * mock-mms.js — simulate an inbound Twilio MMS against the local webhook.
 *
 * Fires an application/x-www-form-urlencoded POST at the inbound SMS handler
 * with the same shape Twilio uses for MMS: NumMedia, MediaUrl0, MediaUrl1...
 * The "media URLs" point at this script's own ephemeral HTTP server, which
 * serves the local image file(s) you passed in — so the photo-intake pipeline
 * sees a normal URL fetch and uploads to R2 + tags + enhances end-to-end.
 *
 * Usage:
 *   node dev/mock-mms.js \
 *     --to http://localhost:3000/api/sms/inbound \
 *     --from +14155550123 \
 *     --image ~/Desktop/pizza.jpg \
 *     [--image ~/Desktop/storefront.jpg ...] \
 *     [--body "first post"]
 *
 * Defaults:
 *   --to:    http://localhost:3000/api/sms/inbound
 *   --from:  +14155550123
 *   --body:  "" (empty body)
 *
 * Twilio signature is NOT generated — set up your env so signature
 * validation is skipped in dev (omit TWILIO_AUTH_TOKEN or set it to a value
 * that's not used at the same time, see lib/api/sms/inbound.js's
 * validateTwilioSignature for the dev bypass behavior).
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URLSearchParams } = require('url');

function parseArgs(argv) {
  const args = { to: 'http://localhost:3000/api/sms/inbound', from: '+14155550123', body: '', images: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--to' && next)    { args.to = next; i++; }
    else if (a === '--from' && next) { args.from = next; i++; }
    else if (a === '--body' && next) { args.body = next; i++; }
    else if (a === '--image' && next) { args.images.push(next); i++; }
    else if (a === '-h' || a === '--help') { args.help = true; }
  }
  return args;
}

function help() {
  console.log(`Usage:
  node dev/mock-mms.js [options]

Options:
  --to <url>        Inbound webhook URL (default: http://localhost:3000/api/sms/inbound)
  --from <e164>     Sender phone number (default: +14155550123)
  --body <text>     SMS body text (default: empty)
  --image <path>    Local image file to attach. Repeat for multiple attachments.
  -h, --help        Show this help
`);
}

function mimeFor(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic', '.heif': 'image/heif',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[ext] || 'application/octet-stream';
}

// Spin up a tiny HTTP server that serves the chosen images at known paths.
// Returns { port, urls[] } once listening.
function startMediaServer(imagePaths) {
  return new Promise((resolve, reject) => {
    const items = imagePaths.map((p, i) => {
      const resolved = path.resolve(p.replace(/^~/, process.env.HOME || ''));
      if (!fs.existsSync(resolved)) {
        throw new Error(`Image not found: ${resolved}`);
      }
      return {
        index: i,
        absPath: resolved,
        mimeType: mimeFor(resolved),
        size: fs.statSync(resolved).size,
      };
    });

    const server = http.createServer((req, res) => {
      const m = req.url.match(/^\/media\/(\d+)$/);
      if (!m) {
        res.statusCode = 404; res.end(); return;
      }
      const item = items[parseInt(m[1], 10)];
      if (!item) { res.statusCode = 404; res.end(); return; }
      res.setHeader('Content-Type', item.mimeType);
      res.setHeader('Content-Length', item.size);
      fs.createReadStream(item.absPath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const urls = items.map((it, i) => ({
        url: `http://127.0.0.1:${port}/media/${i}`,
        mimeType: it.mimeType,
      }));
      resolve({ port, urls, items, close: () => server.close() });
    });
    server.on('error', reject);
  });
}

async function postInbound({ to, from, body, mediaUrls }) {
  const params = new URLSearchParams();
  params.set('From', from);
  params.set('To', '+18555550123');
  params.set('Body', body);
  params.set('MessageSid', 'MM' + Math.random().toString(36).slice(2, 14).padEnd(32, '0'));
  params.set('NumMedia', String(mediaUrls.length));
  mediaUrls.forEach((m, i) => {
    params.set(`MediaUrl${i}`, m.url);
    params.set(`MediaContentType${i}`, m.mimeType);
  });

  const res = await fetch(to, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { help(); process.exit(0); }
  if (args.images.length === 0) {
    console.error('At least one --image is required. Use -h for help.');
    process.exit(1);
  }

  console.log(`mock-mms: serving ${args.images.length} image(s)`);
  const media = await startMediaServer(args.images);
  console.log(`  local media server on http://127.0.0.1:${media.port}`);
  media.urls.forEach((u, i) => console.log(`    [${i}] ${u.mimeType}  ${u.url}  (${media.items[i].size}B)`));

  console.log(`\nmock-mms: POST ${args.to}`);
  console.log(`  From: ${args.from}`);
  console.log(`  Body: ${args.body || '(empty)'}`);

  try {
    const out = await postInbound({ to: args.to, from: args.from, body: args.body, mediaUrls: media.urls });
    console.log(`\nresponse: ${out.status}`);
    if (out.body) console.log(out.body.slice(0, 500));
  } catch (err) {
    console.error('\nrequest failed:', err.message);
    process.exitCode = 1;
  } finally {
    // Wait a beat so the webhook has time to fetch the media before we close.
    setTimeout(() => media.close(), 2000);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
