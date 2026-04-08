'use strict';

/**
 * Email sending utility for Sidekick.
 *
 * Supports two providers via EMAIL_PROVIDER env var:
 *   - "sendgrid" — uses SENDGRID_API_KEY
 *   - "resend"   — uses RESEND_API_KEY
 *
 * Usage:
 *   const { sendEmail } = require('./lib/email');
 *   const result = await sendEmail('user@example.com', 'Subject', '<p>HTML body</p>');
 *   if (result.error) console.error(result.error);
 */

const FROM_EMAIL = process.env.EMAIL_FROM || 'Sidekick <hello@getsidekick.co>';
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER; // 'sendgrid' | 'resend'

/**
 * Send an email.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 * @param {object} [options] - Optional extras: { replyTo, text }
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail(to, subject, html, options = {}) {
  if (!EMAIL_PROVIDER) {
    const msg = 'EMAIL_PROVIDER not configured. Set to "sendgrid" or "resend" in environment variables.';
    console.warn('[email]', msg);
    return { ok: false, error: msg };
  }

  if (!to || !subject || !html) {
    return { ok: false, error: 'Missing required parameters: to, subject, html' };
  }

  try {
    if (EMAIL_PROVIDER === 'sendgrid') {
      return await sendViaSendgrid(to, subject, html, options);
    } else if (EMAIL_PROVIDER === 'resend') {
      return await sendViaResend(to, subject, html, options);
    } else {
      return { ok: false, error: `Unknown EMAIL_PROVIDER: "${EMAIL_PROVIDER}". Use "sendgrid" or "resend".` };
    }
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    return { ok: false, error: err.message || 'Unknown error sending email' };
  }
}

/**
 * Send via SendGrid REST API (no SDK dependency).
 * @private
 */
async function sendViaSendgrid(to, subject, html, options) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'SENDGRID_API_KEY is not set' };
  }

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: parseEmailAddress(FROM_EMAIL),
    subject,
    content: [{ type: 'text/html', value: html }],
  };

  if (options.text) {
    payload.content.unshift({ type: 'text/plain', value: options.text });
  }

  if (options.replyTo) {
    payload.reply_to = parseEmailAddress(options.replyTo);
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 202) {
    const messageId = res.headers.get('x-message-id') || null;
    return { ok: true, messageId };
  }

  let errorBody = '';
  try {
    const json = await res.json();
    errorBody = json.errors ? json.errors.map(e => e.message).join('; ') : JSON.stringify(json);
  } catch {
    errorBody = `HTTP ${res.status}`;
  }

  console.error('[email:sendgrid] Error:', errorBody);
  return { ok: false, error: `SendGrid error: ${errorBody}` };
}

/**
 * Send via Resend REST API (no SDK dependency).
 * @private
 */
async function sendViaResend(to, subject, html, options) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not set' };
  }

  const payload = {
    from: FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (options.text) {
    payload.text = options.text;
  }

  if (options.replyTo) {
    payload.reply_to = options.replyTo;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));

  if (res.ok && json.id) {
    return { ok: true, messageId: json.id };
  }

  const errorMsg = json.message || json.error || `HTTP ${res.status}`;
  console.error('[email:resend] Error:', errorMsg);
  return { ok: false, error: `Resend error: ${errorMsg}` };
}

/**
 * Parse "Name <email@domain.com>" into { name, email } object.
 * @private
 */
function parseEmailAddress(address) {
  const match = address.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: address.trim() };
}

/**
 * Render an email template by replacing {{PLACEHOLDER}} tokens.
 * @param {string} template - HTML template string
 * @param {object} vars - Key/value pairs to substitute
 * @returns {string}
 */
function renderTemplate(template, vars = {}) {
  return Object.entries(vars).reduce((html, [key, value]) => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    return html.replace(pattern, value ?? '');
  }, template);
}

/**
 * Load an email template from the /emails directory and render it.
 * @param {string} templateName - e.g. 'welcome', 'referral-reward'
 * @param {object} vars - Template variables
 * @returns {string} Rendered HTML
 */
function loadTemplate(templateName, vars = {}) {
  const fs = require('fs');
  const path = require('path');
  const templatePath = path.join(__dirname, '..', 'emails', `${templateName}.html`);

  let html;
  try {
    html = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    throw new Error(`Email template not found: ${templateName} (looked at ${templatePath})`);
  }

  return renderTemplate(html, vars);
}

module.exports = { sendEmail, renderTemplate, loadTemplate };
