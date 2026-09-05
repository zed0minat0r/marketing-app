'use strict';

/**
 * A YES approves the draft the owner was SHOWN, not whatever is newest.
 *
 * Between Sidekick texting a drafted reply and the owner replying YES, another comment can arrive
 * and create a newer draft. Looking up "the latest pending draft" then posted a reply to the owner's
 * Page that they had never seen - published in their name, unapproved. The lookup is pinned to the
 * timestamp of the message that offered it.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const rows = [
  { id: 'older', user_id: 'u1', status: 'draft', created_at: '2026-09-05T10:00:00.000Z', draft_reply: 'the one they saw' },
  { id: 'newer', user_id: 'u1', status: 'draft', created_at: '2026-09-05T10:05:00.000Z', draft_reply: 'arrived after' },
];

// Minimal stand-in for the query chain the lookup builds.
function makeClient() {
  const state = {};
  const chain = {
    from() { return chain; },
    select() { return chain; },
    eq() { return chain; },
    lte(_c, v) { state.notAfter = v; return chain; },
    order() { return chain; },
    limit() { return chain; },
    async maybeSingle() {
      const eligible = rows
        .filter((r) => !state.notAfter || r.created_at <= state.notAfter)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { data: eligible[0] || null };
    },
  };
  return chain;
}

const supabasePath = require.resolve('../lib/supabase');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true,
  exports: { getClient: makeClient, getSocialAccount: async () => null } };

const { getPendingCommentReply } = require('../lib/comment-replies');

describe('YES approves the draft that was offered', () => {
  test('pinned to the outbound timestamp, it returns the draft the owner saw', async () => {
    const offeredAt = '2026-09-05T10:01:00.000Z';   // we texted them after the older draft
    const pending = await getPendingCommentReply('u1', offeredAt);
    assert.equal(pending.id, 'older', 'must approve the draft that existed when we asked');
  });

  test('without pinning it would grab the newer one - the bug this closes', async () => {
    const pending = await getPendingCommentReply('u1');
    assert.equal(pending.id, 'newer', 'unpinned lookup is exactly the race');
  });
});
