'use strict';

/**
 * POST /api/ai/generate
 *
 * Internal endpoint: Call Claude API with conversation context.
 * Used for direct AI generation without SMS delivery.
 *
 * Body: { user_id: "uuid", message: "...", conversation_history: [...] }
 * Response: { reply: "...", intent: "...", action: {...} }
 */

const { generateResponse } = require('../../lib/claude');
const { getUserByPhone, getRecentMessages, getSocialAccounts } = require('../../lib/supabase');
const { requireInternalAuth } = require('../../lib/internal-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal endpoints require shared-secret auth
  if (!requireInternalAuth(req, res)) return;

  const { user_id, message, conversation_history } = req.body || {};

  if (!user_id || !message) {
    return res.status(400).json({ error: 'user_id and message are required' });
  }

  try {
    const { getClient } = require('../../lib/supabase');
    const { data: user, error } = await getClient()
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const history = conversation_history || await getRecentMessages(user_id, 20);
    const accounts = await getSocialAccounts(user_id);
    const platforms = accounts.map(a => a.platform);

    const result = await generateResponse(user, message, history, platforms);

    return res.status(200).json({
      reply: result.reply_text,
      intent: result.intent,
      action: result.action,
      model: result.model,
      tokens_used: result.tokensUsed,
    });

  } catch (err) {
    console.error('AI generate error:', err);
    return res.status(500).json({ error: err.message });
  }
};
