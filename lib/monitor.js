'use strict';

/**
 * Error capture + owner alerting.
 *
 * reportError(source, err, context) is safe to call from ANY catch block:
 * it never throws and never sends SMS to end users - it records the error
 * and (deduped) tells the owner. One alert email per source per hour;
 * context.critical additionally sends an SMS to ALERT_SMS_TO.
 *
 * Env: NOTIFY_EMAIL (already set for waitlist), ALERT_SMS_TO (owner's phone,
 * optional - without it critical alerts are email-only).
 */

const ALERT_WINDOW_MS = 60 * 60 * 1000;

async function reportError(source, err, context = {}) {
  const message = (err && err.message) ? String(err.message) : String(err);
  const stack = err && err.stack ? String(err.stack).slice(0, 4000) : null;
  console.error(`[${source}]`, message);

  let row = null;
  try {
    const { getClient } = require('./supabase');
    const { userId, critical, ...rest } = context;
    const res = await getClient()
      .from('errors')
      .insert({ source, message: message.slice(0, 2000), stack, context: rest, user_id: userId || null })
      .select('id')
      .single();
    row = res.data;
  } catch (dbErr) {
    // DB down is exactly when alerting matters most - keep going.
    console.error('[monitor] could not store error:', dbErr.message);
  }

  try {
    await maybeAlert(`err:${source}`, `Sidekick error in ${source}`, [
      `Source: ${source}`,
      `Message: ${message}`,
      context.userId ? `User: ${context.userId}` : null,
      row ? `Error id: ${row.id}` : 'NOT stored (database unreachable)',
      stack ? `\n${stack.split('\n').slice(0, 6).join('\n')}` : null,
    ].filter(Boolean).join('\n'), { sms: Boolean(context.critical) });
  } catch (alertErr) {
    console.error('[monitor] alert failed:', alertErr.message);
  }

  return row;
}

/**
 * Send an owner alert unless the same key alerted within the window.
 * Suppressed alerts are counted and the count is included next time.
 */
async function maybeAlert(key, subject, body, { sms = false } = {}) {
  let suppressed = 0;
  try {
    const { getClient } = require('./supabase');
    const supa = getClient();
    const { data: state } = await supa
      .from('alert_state').select('last_sent_at,suppressed_count').eq('key', key).maybeSingle();
    const last = state?.last_sent_at ? new Date(state.last_sent_at).getTime() : 0;
    if (Date.now() - last < ALERT_WINDOW_MS) {
      await supa.from('alert_state')
        .update({ suppressed_count: (state.suppressed_count || 0) + 1 })
        .eq('key', key);
      return { sent: false, suppressed: true };
    }
    suppressed = state?.suppressed_count || 0;
    await supa.from('alert_state').upsert({ key, last_sent_at: new Date().toISOString(), suppressed_count: 0 });
  } catch {
    // No dedupe state available: still alert (a duplicate beats silence).
  }

  const suffix = suppressed > 0 ? `\n\n(${suppressed} similar alert${suppressed === 1 ? '' : 's'} suppressed in the last hour)` : '';
  const to = process.env.NOTIFY_EMAIL;
  let emailed = false;
  if (to) {
    try {
      const { sendEmail } = require('./email');
      await sendEmail(to, subject, `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(body + suffix)}</pre>`);
      emailed = true;
    } catch (e) {
      console.error('[monitor] alert email failed:', e.message);
    }
  }

  let texted = false;
  if (sms && process.env.ALERT_SMS_TO) {
    try {
      const { sendSms } = require('./sms-outbound');
      await sendSms(process.env.ALERT_SMS_TO, `${subject}\n${body.slice(0, 280)}${suffix}`);
      texted = true;
    } catch (e) {
      console.error('[monitor] alert SMS failed:', e.message);
    }
  }
  return { sent: emailed || texted, emailed, texted };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

module.exports = { reportError, maybeAlert, ALERT_WINDOW_MS };
