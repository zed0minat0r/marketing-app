'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  normalizeUrl,
  extractUrl,
  isPrivateIp,
  analyzeHtml,
  formatAuditSms,
} = require('../lib/website-audit');

describe('normalizeUrl', () => {
  test('adds https and accepts bare domains', () => {
    assert.equal(normalizeUrl('mikespizza.com'), 'https://mikespizza.com/');
    assert.equal(normalizeUrl('http://mikespizza.com/menu'), 'http://mikespizza.com/menu');
  });
  test('strips trailing punctuation from texted urls', () => {
    assert.equal(normalizeUrl('mikespizza.com.'), 'https://mikespizza.com/');
  });
  test('rejects junk, bare words, odd ports, non-http schemes', () => {
    assert.equal(normalizeUrl('pizza'), null);
    assert.equal(normalizeUrl('ftp://x.com'), null);
    assert.equal(normalizeUrl('https://x.com:8080'), null);
    assert.equal(normalizeUrl(''), null);
    assert.equal(normalizeUrl(null), null);
  });
});

describe('extractUrl', () => {
  test('finds a url inside a sentence', () => {
    assert.equal(extractUrl('audit my site mikespizza.com please'), 'https://mikespizza.com/');
    assert.equal(extractUrl('check https://www.bloomstem.co/about'), 'https://www.bloomstem.co/about');
  });
  test('returns null when there is no url', () => {
    assert.equal(extractUrl('audit my website'), null);
    assert.equal(extractUrl('check my site please'), null);
  });
});

describe('isPrivateIp (SSRF guard)', () => {
  test('blocks loopback, RFC1918, link-local, and v6 internals', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.9', '172.31.255.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
      assert.equal(isPrivateIp(ip), true, ip);
    }
  });
  test('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '104.21.5.9', '172.15.0.1', '172.32.0.1']) {
      assert.equal(isPrivateIp(ip), false, ip);
    }
  });
});

describe('analyzeHtml', () => {
  const goodHtml = `<!doctype html><html><head>
    <title>Mike's Pizza - Wood-Fired Pizza in Phoenixville</title>
    <meta name="description" content="Family-owned wood-fired pizza in downtown Phoenixville. Dine in, take out, and catering for every occasion.">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta property="og:title" content="Mike's Pizza">
    </head><body><h1>Mike's Pizza</h1>
    <p>${'Great pizza and a warm welcome. '.repeat(40)}</p>
    <p>Call us at (610) 555-0123 to order.</p>
    <img src="a.jpg" alt="wood-fired oven"><img src="b.jpg" alt="margherita pizza">
    </body></html>`;

  test('healthy page produces passing findings', () => {
    const f = analyzeHtml(goodHtml, { finalUrl: 'https://mikespizza.com/', responseMs: 800 });
    assert.equal(f.https, true);
    assert.equal(f.slow, false);
    assert.equal(f.titleOk, true);
    assert.equal(f.descriptionOk, true);
    assert.equal(f.viewport, true);
    assert.equal(f.phoneVisible, true);
    assert.equal(f.imgAltCoverage, 100);
    assert.ok(f.wordCount > 150);
  });

  test('bare page produces the right failures', () => {
    const f = analyzeHtml('<html><body><img src="x.jpg"><p>Hi.</p></body></html>', { finalUrl: 'http://x.com/', responseMs: 4500 });
    assert.equal(f.https, false);
    assert.equal(f.slow, true);
    assert.equal(f.titleOk, false);
    assert.equal(f.viewport, false);
    assert.equal(f.phoneVisible, false);
    assert.equal(f.imgAltCoverage, 0);
    assert.ok(f.wordCount < 150);
  });

  test('tel: link counts as a visible phone number', () => {
    const f = analyzeHtml('<html><body><a href="tel:+16105550123">Call</a></body></html>', { finalUrl: 'https://x.com/', responseMs: 100 });
    assert.equal(f.phoneVisible, true);
  });
});

describe('formatAuditSms', () => {
  test('failing page lists numbered fixes and stays GSM-clean', () => {
    const f = analyzeHtml('<html><body><p>Hi.</p></body></html>', { finalUrl: 'http://x.com/', responseMs: 5000 });
    const sms = formatAuditSms(f, 'http://x.com/');
    assert.ok(sms.includes('1.'));
    assert.ok(sms.includes('top fixes'));
    assert.ok(!sms.includes('—'), 'no em dashes in SMS');
    assert.ok(sms.length < 480);
  });
  test('healthy page gets a positive summary with a next step', () => {
    const f = {
      https: true, responseMs: 700, slow: false, title: 'Good Title Here', titleOk: true,
      description: 'x'.repeat(80), descriptionOk: true, viewport: true, h1Count: 1,
      phoneVisible: true, imgCount: 2, imgAltCoverage: 100, wordCount: 400, hasOg: true,
    };
    const sms = formatAuditSms(f, 'https://mikespizza.com/');
    assert.ok(sms.toLowerCase().includes('solid'));
  });
  test('fetch failure is honest and actionable', () => {
    const sms = formatAuditSms({ fetchFailed: true, status: 404 }, 'https://x.com/');
    assert.ok(sms.includes('404'));
  });
});
