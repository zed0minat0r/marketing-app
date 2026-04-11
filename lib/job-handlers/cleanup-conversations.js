'use strict';

/**
 * POST /api/jobs/cleanup-conversations
 *
 * QStash weekly cron job (Sunday 3am UTC).
 * Deletes conversation records older than 90 days per retention policy.
 * Texts affected users to inform them of the cleanup.
 */

const { getClient } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

async function verifyQStashSignature(req) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentKey) {
    console.warn('QSTASH_CURRENT_SIGNING_KEY not set — skipping signature verification');
    return true; // Allow in dev
  }

  const signature = req.headers['upstash-signature'];
  if (!signature) return false;

  try {
    const { Receiver } = require('@upstash/qstash');
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    });
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
    return true;
  } catch (err) {
    console.error('QStash signature verification failed:', err.message);
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isValid = await verifyQStashSignature(req);
  if (!isValid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const client = getClient();

  try {
    // Find distinct users who have conversations older than 90 days
    // so we can notify them before deleting
    const { data: affectedRows, error: queryError } = await client
      .from('conversations')
      .select('user_id')
      .lt('created_at', cutoffDate);

    if (queryError) throw queryError;

    // Deduplicate user IDs
    const affectedUserIds = [...new Set((affectedRows || []).map(r => r.user_id))];

    if (affectedUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        deletedCount: 0,
        usersNotified: 0,
        message: 'No conversations older than 90 days',
      });
    }

    // Fetch user phone numbers for notification
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, phone')
      .in('id', affectedUserIds)
      .not('phone', 'is', null);

    if (usersError) throw usersError;

    // Delete the old conversations
    const { error: deleteError } = await client
      .from('conversations')
      .delete()
      .lt('created_at', cutoffDate);

    if (deleteError) throw deleteError;

    // Notify affected users
    let notified = 0;
    const notifyMsg =
      'Sidekick: Your message history older than 90 days has been cleared per our data retention policy. Your account and posts are unaffected.';

    for (const user of (users || [])) {
      await sendSms(user.phone, notifyMsg).catch(err => {
        console.error(`Cleanup notify failed for user ${user.id}:`, err.message);
      });
      notified++;
    }

    console.log(`Conversation cleanup: deleted records for ${affectedUserIds.length} users, notified ${notified}`);

    return res.status(200).json({
      success: true,
      deletedForUsers: affectedUserIds.length,
      usersNotified: notified,
      cutoffDate,
    });

  } catch (err) {
    console.error('Conversation cleanup job error:', err);
    return res.status(500).json({ error: err.message });
  }
};
