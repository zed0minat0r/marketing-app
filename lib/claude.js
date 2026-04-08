'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt, CLAUDE_MODELS } = require('./constants');

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY must be set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Convert stored conversation records to Claude message format.
 * @param {Array} messages - Array of {direction, body} records from DB
 * @returns {Array} Claude-formatted messages
 */
function formatConversationHistory(messages) {
  return messages.map(msg => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.body,
  }));
}

/**
 * Parse Claude's JSON response safely.
 * Claude is instructed to reply with JSON only. Handle edge cases gracefully.
 */
function parseClaudeResponse(rawText) {
  try {
    // Strip any accidental markdown code fences
    const cleaned = rawText
      .replace(/^```json\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      reply_text: parsed.reply_text || 'Sorry, something went wrong. Please try again.',
      intent: parsed.intent || 'unknown',
      action: parsed.action || null,
    };
  } catch (err) {
    console.error('Failed to parse Claude response as JSON:', rawText.slice(0, 200));

    // If Claude returned plain text (not JSON), use it as-is
    return {
      reply_text: rawText.slice(0, 320), // SMS safety trim
      intent: 'unknown',
      action: null,
    };
  }
}

/**
 * Generate an AI response with full conversation context.
 *
 * @param {Object} user - User record from DB
 * @param {string} incomingMessage - The user's current SMS text
 * @param {Array} conversationHistory - Last N messages from DB
 * @param {Array} connectedPlatforms - Platform names user has connected
 * @returns {Promise<{reply_text, intent, action, model, tokensUsed}>}
 */
async function generateResponse(user, incomingMessage, conversationHistory, connectedPlatforms = []) {
  const client = getClient();
  const systemPrompt = buildSystemPrompt(user, connectedPlatforms);

  // Build message array: history + current message
  const history = formatConversationHistory(conversationHistory);
  const messages = [
    ...history,
    { role: 'user', content: incomingMessage },
  ];

  // Use fast model for most requests
  const model = CLAUDE_MODELS.fast;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const rawText = response.content[0]?.text || '';
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  const parsed = parseClaudeResponse(rawText);

  return {
    ...parsed,
    model,
    tokensUsed,
  };
}

/**
 * Generate a weekly analytics summary using Claude.
 * Uses a simpler, analytics-focused prompt.
 */
async function generateWeeklySummary(user, metrics) {
  const client = getClient();

  const prompt = `Generate a weekly marketing summary SMS for ${user.business_name || 'this business'}.

Data:
- Posts published: ${metrics.postsCount}
- Total reach: ${metrics.totalReach}
- Total engagement (likes+comments+shares): ${metrics.totalEngagement}
- Previous week reach: ${metrics.prevReach || 'unknown'}
- Top post: ${metrics.topPostContent ? `"${metrics.topPostContent.slice(0, 80)}"` : 'N/A'}
- Top post likes: ${metrics.topPostLikes || 0}

Tone: ${user.tone || 'professional'}
Business type: ${user.business_type || 'business'}

Write a concise weekly SMS report (under 320 chars). Include:
1. Key numbers
2. Percent change vs last week (if available)
3. One actionable tip based on what worked

Respond with JSON:
{"summary": "the SMS text here"}`;

  const response = await client.messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0]?.text || '';

  try {
    const cleaned = rawText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.summary || rawText.slice(0, 320);
  } catch {
    return rawText.slice(0, 320);
  }
}

module.exports = {
  generateResponse,
  generateWeeklySummary,
};
