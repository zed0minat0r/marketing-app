'use strict';

/**
 * mock-twilio.js
 *
 * Intercepts Twilio SMS webhook POST requests and prints them to the terminal
 * instead of sending real texts. Listens on port 3001 by default.
 *
 * Usage:
 *   node dev/mock-twilio.js
 *
 * In your .env.local, set:
 *   TWILIO_WEBHOOK_URL=http://localhost:3001/sms/inbound
 *
 * Then point your app's inbound SMS handler at this mock instead of Twilio.
 * The mock also exposes a /sms/send endpoint to simulate outbound delivery.
 */

const http = require('http');
const { URLSearchParams } = require('url');

const PORT = process.env.MOCK_TWILIO_PORT || 3001;
const messages = []; // in-memory log

// ANSI colors for terminal output
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(label, color, ...args) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${C.dim}[${ts}]${C.reset} ${color}${C.bold}${label}${C.reset}`, ...args);
}

function printSMS({ direction, from, to, body, sid }) {
  const arrow = direction === 'inbound' ? '<--' : '-->';
  const color = direction === 'inbound' ? C.green : C.blue;
  console.log();
  console.log(`  ${color}${C.bold}SMS ${arrow}${C.reset}`);
  console.log(`  ${C.dim}SID:  ${C.reset}${C.cyan}${sid}${C.reset}`);
  console.log(`  ${C.dim}From: ${C.reset}${from}`);
  console.log(`  ${C.dim}To:   ${C.reset}${to}`);
  console.log(`  ${C.dim}Body: ${C.reset}${C.bold}${body}${C.reset}`);
  console.log();
}

function parseBody(raw) {
  try {
    return Object.fromEntries(new URLSearchParams(raw));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function twimlOk(body = '') {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function jsonRes(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

let sidCounter = 1000;
function fakeSid() {
  return `SM_MOCK_${Date.now()}_${++sidCounter}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();
  const path = url.pathname;

  // ---- INBOUND WEBHOOK (Twilio calls this when an SMS arrives) ----
  if (method === 'POST' && path === '/sms/inbound') {
    const raw = await readBody(req);
    const params = parseBody(raw);

    const msg = {
      direction: 'inbound',
      sid: params.MessageSid || fakeSid(),
      from: params.From || 'UNKNOWN',
      to: params.To || process.env.TWILIO_PHONE_NUMBER || '+10000000000',
      body: params.Body || '',
      timestamp: new Date().toISOString(),
    };

    messages.push(msg);
    log('INBOUND', C.green, `from ${msg.from}`);
    printSMS(msg);

    // Return TwiML so the app's Twilio validator doesn't choke
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twimlOk());
    return;
  }

  // ---- OUTBOUND SEND (app calls this instead of Twilio REST API) ----
  // Mimics POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
  if (method === 'POST' && (path === '/sms/send' || path.endsWith('/Messages.json'))) {
    const raw = await readBody(req);
    const params = parseBody(raw);

    const sid = fakeSid();
    const msg = {
      direction: 'outbound',
      sid,
      from: params.From || process.env.TWILIO_PHONE_NUMBER || '+10000000000',
      to: params.To || 'UNKNOWN',
      body: params.Body || '',
      timestamp: new Date().toISOString(),
    };

    messages.push(msg);
    log('OUTBOUND', C.blue, `to ${msg.to}`);
    printSMS(msg);

    // Return Twilio-shaped JSON so existing code using twilio SDK works
    jsonRes(res, 201, {
      sid,
      account_sid: 'AC_MOCK',
      from: msg.from,
      to: msg.to,
      body: msg.body,
      status: 'sent',
      direction: 'outbound-api',
      date_created: msg.timestamp,
      date_updated: msg.timestamp,
      price: null,
      uri: `/2010-04-01/Accounts/AC_MOCK/Messages/${sid}.json`,
    });
    return;
  }

  // ---- MESSAGE LOG (view recent messages in browser/curl) ----
  if (method === 'GET' && path === '/messages') {
    jsonRes(res, 200, { count: messages.length, messages: messages.slice(-50).reverse() });
    return;
  }

  // ---- HEALTH ----
  if (method === 'GET' && path === '/health') {
    jsonRes(res, 200, { status: 'ok', messages: messages.length, port: PORT });
    return;
  }

  // ---- 404 ----
  jsonRes(res, 404, { error: 'Not found', path, method });
});

server.listen(PORT, () => {
  console.log();
  console.log(`  ${C.bold}${C.cyan}Sidekick Mock Twilio${C.reset}`);
  console.log(`  ${C.dim}Listening on${C.reset} http://localhost:${PORT}`);
  console.log();
  console.log(`  Endpoints:`);
  console.log(`    POST /sms/inbound           Simulate inbound SMS from Twilio`);
  console.log(`    POST /sms/send              Intercept outbound SMS (set TWILIO_API_URL)`);
  console.log(`    GET  /messages              View recent message log (JSON)`);
  console.log(`    GET  /health                Health check`);
  console.log();
  console.log(`  Test with curl:`);
  console.log(`    curl -X POST http://localhost:${PORT}/sms/inbound \\`);
  console.log(`      -d "From=%2B14845551234&To=%2B18005550100&Body=Hello+Sidekick"`);
  console.log();
  log('READY', C.magenta, 'Intercepting SMS traffic — real Twilio will NOT be called');
  console.log();
});

server.on('error', err => {
  console.error(`${C.red}Server error:${C.reset}`, err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log();
  log('SHUTDOWN', C.yellow, `${messages.length} messages intercepted this session`);
  console.log();
  process.exit(0);
});
