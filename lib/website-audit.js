'use strict';

/**
 * Website audit - "Audit my website" SMS command.
 *
 * Fetches the business's homepage and checks small-business fundamentals:
 * https, response time, title/description, mobile viewport, a visible phone
 * number, image alt coverage, and thin content. Deterministic checks with a
 * plain-language SMS summary - no invented scores.
 *
 * The URL is user-supplied, so fetching is SSRF-guarded: http(s) only,
 * default ports, hostname must resolve to a public IP, and every redirect
 * hop is re-validated.
 */

const dns = require('dns').promises;
const net = require('net');

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

/** Normalize free-text into an https URL, or return null. */
function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[.,;!?)]+$/, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  if (!u.hostname.includes('.')) return null;
  return u.toString();
}

/** Extract the first URL-looking token from a message, if any. */
function extractUrl(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/\b((?:https?:\/\/)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+(?:\/[^\s]*)?)\b/i);
  if (!m) return null;
  // Reject bare words that merely contain a dot but are clearly not hosts
  const candidate = m[1];
  if (!/\.[a-z]{2,}(\/|$)/i.test(candidate)) return null;
  return normalizeUrl(candidate);
}

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    return low === '::1' || low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')
      || low.startsWith('::ffff:127.') || low.startsWith('::ffff:10.') || low.startsWith('::ffff:192.168.');
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  return a === 127 || a === 10 || a === 0
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254);
}

/** Resolve the hostname and refuse private/internal destinations. */
async function assertPublicHost(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new Error('blocked host');
  }
  if (net.isIP(lower) && isPrivateIp(lower)) throw new Error('blocked host');
  if (!net.isIP(lower)) {
    const { address } = await dns.lookup(lower);
    if (isPrivateIp(address)) throw new Error('blocked host');
  }
}

/** Fetch with manual, validated redirects and a size cap. */
async function fetchPage(url) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    await assertPublicHost(u.hostname);
    const started = Date.now();
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'SidekickAudit/1.0 (+https://marketing-app-navy.vercel.app)' },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`redirect without location (HTTP ${res.status})`);
      current = new URL(loc, current).toString();
      continue;
    }
    const responseMs = Date.now() - started;
    if (!res.ok) return { ok: false, status: res.status, finalUrl: current, responseMs };
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    return { ok: true, status: res.status, finalUrl: current, responseMs, html };
  }
  throw new Error('too many redirects');
}

/** Pure HTML checks - no network. */
function analyzeHtml(html, { finalUrl, responseMs }) {
  const lower = html.toLowerCase();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const imgsWithAlt = imgs.filter(t => /\balt=["'][^"']+["']/i.test(t)).length;

  const findings = {
    https: finalUrl.startsWith('https://'),
    responseMs,
    slow: responseMs > 3000,
    title,
    titleOk: title.length >= 10 && title.length <= 70,
    description,
    descriptionOk: description.length >= 50 && description.length <= 170,
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    h1Count: (html.match(/<h1[\s\b>]/gi) || []).length,
    phoneVisible: /(\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/.test(text) || /href=["']tel:/i.test(html),
    imgCount: imgs.length,
    imgAltCoverage: imgs.length ? Math.round((imgsWithAlt / imgs.length) * 100) : 100,
    wordCount: text.split(' ').filter(Boolean).length,
    hasOg: /<meta[^>]+property=["']og:/i.test(lower),
  };
  return findings;
}

/** Plain-language SMS: worst problems first, one strength, GSM-safe. */
function formatAuditSms(f, url) {
  const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  if (f.fetchFailed) {
    return `I couldn't load ${host} (${f.status ? 'HTTP ' + f.status : 'no response'}). If the address is right, your site may be down - that's the first thing to fix.`;
  }
  const issues = [];
  if (!f.https) issues.push('no HTTPS - browsers mark you "Not Secure"');
  if (!f.viewport) issues.push('not mobile-ready (no viewport tag) - most local customers are on phones');
  if (f.slow) issues.push(`slow to load (${(f.responseMs / 1000).toFixed(1)}s) - visitors leave after ~3s`);
  if (!f.phoneVisible) issues.push('no phone number visible on the homepage');
  if (!f.title || !f.titleOk) issues.push(f.title ? 'page title is a poor length for Google (aim 10-70 chars)' : 'missing page title - hurts Google ranking');
  if (!f.description || !f.descriptionOk) issues.push(f.description ? 'search description is a poor length (aim 50-170 chars)' : 'missing search description - Google writes its own');
  if (f.wordCount < 150) issues.push('very thin content - Google favors pages that say more');
  if (f.imgCount > 0 && f.imgAltCoverage < 50) issues.push('most images lack descriptions (alt text)');

  const strengths = [];
  if (f.https) strengths.push('HTTPS is set up');
  if (f.viewport) strengths.push('mobile-ready');
  if (!f.slow) strengths.push(`loads fast (${(f.responseMs / 1000).toFixed(1)}s)`);
  if (f.phoneVisible) strengths.push('phone number is easy to find');

  if (issues.length === 0) {
    return `Checked ${host} - the fundamentals look solid: ${strengths.slice(0, 3).join(', ')}. Want a post drafted to show it off?`;
  }
  const top = issues.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n');
  const good = strengths.length ? `\nGood news: ${strengths[0]}.` : '';
  return `Checked ${host} - top fixes:\n${top}${good}\nWant me to draft a post while you fix those?`;
}

/** End-to-end: fetch + analyze. Returns { sms, findings }. */
async function runWebsiteAudit(url) {
  let page;
  try {
    page = await fetchPage(url);
  } catch (err) {
    return { sms: formatAuditSms({ fetchFailed: true }, url), findings: { fetchFailed: true, error: err.message } };
  }
  if (!page.ok) {
    return { sms: formatAuditSms({ fetchFailed: true, status: page.status }, url), findings: { fetchFailed: true, status: page.status } };
  }
  const findings = analyzeHtml(page.html, page);
  return { sms: formatAuditSms(findings, page.finalUrl), findings };
}

module.exports = {
  normalizeUrl,
  extractUrl,
  isPrivateIp,
  analyzeHtml,
  formatAuditSms,
  runWebsiteAudit,
};
