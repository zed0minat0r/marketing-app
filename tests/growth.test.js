'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  postEngagement,
  computeInsights,
  evaluateExperiment,
  proposeExperiment,
} = require('../lib/growth');

const TZ = 'America/New_York';

function snap(postId, platform, date, likes, comments = 0) {
  return { post_id: postId, platform, snapshot_date: date, likes, comments, shares: 0, saves: 0, clicks: 0, reach: likes * 10 };
}

describe('postEngagement', () => {
  test('uses the latest snapshot per platform, not the sum of snapshots', () => {
    const snaps = [
      snap('p1', 'instagram', '2026-08-20', 5),
      snap('p1', 'instagram', '2026-08-22', 12), // cumulative later value wins
      snap('p1', 'facebook', '2026-08-22', 3),
    ];
    const r = postEngagement('p1', snaps);
    assert.equal(r.engagement, 15); // 12 + 3, not 5+12+3
    assert.equal(r.measured, true);
  });
  test('unmeasured post reports measured: false', () => {
    assert.equal(postEngagement('nope', []).measured, false);
  });
});

describe('computeInsights', () => {
  const posts = [];
  const snaps = [];
  // 4 "special" topic posts with high engagement, 3 "tip" posts low
  for (let i = 0; i < 4; i++) {
    posts.push({ id: `s${i}`, content: `special ${i}`, topic: 'weekend special', format: 'offer', scheduled_for: '2026-08-20T23:00:00Z', created_at: '2026-08-19T00:00:00Z' });
    snaps.push(snap(`s${i}`, 'instagram', '2026-08-22', 20));
  }
  for (let i = 0; i < 3; i++) {
    posts.push({ id: `t${i}`, content: `tip ${i}`, topic: 'marketing tip', format: 'tip', scheduled_for: '2026-08-20T15:00:00Z', created_at: '2026-08-19T00:00:00Z' });
    snaps.push(snap(`t${i}`, 'instagram', '2026-08-22', 2));
  }

  test('finds bucket winners with enough samples', () => {
    const ins = computeInsights(posts, snaps, TZ);
    assert.equal(ins.sample_size, 7);
    assert.equal(ins.top_topic.name, 'weekend special');
    assert.equal(ins.top_format.name, 'offer');
    assert.equal(ins.best_post.engagement, 20);
  });

  test('small buckets produce no trend claims', () => {
    const two = posts.slice(0, 2);
    const ins = computeInsights(two, snaps, TZ);
    assert.equal(ins.sample_size, 2);
    assert.equal(ins.top_topic, undefined); // 2 posts < MIN_BUCKET_SAMPLE
    assert.ok(ins.best_post); // best-post callout still allowed
  });

  test('no measured posts yields bare insights', () => {
    const ins = computeInsights([{ id: 'x', content: 'x' }], [], TZ);
    assert.equal(ins.sample_size, 0);
    assert.equal(ins.best_post, undefined);
  });
});

describe('evaluateExperiment', () => {
  const exp = { type: 'format', variant: 'question', started_at: '2026-08-01T00:00:00Z', status: 'live' };
  const mk = (id, format, eng) => ({ id, format, content: id, created_at: '2026-08-10T00:00:00Z', scheduled_for: null });

  test('insufficient data is reported, never guessed', () => {
    const posts = [mk('a', 'question'), mk('b', 'offer')];
    const snaps = [snap('a', 'instagram', '2026-08-22', 5), snap('b', 'instagram', '2026-08-22', 3)];
    const r = evaluateExperiment(exp, posts, snaps, TZ);
    assert.equal(r.verdict, 'insufficient');
    assert.match(r.detail, /need 2\+/);
  });

  test('variant wins when its measured average is higher', () => {
    const posts = [
      { id: 'q1', format: 'question', created_at: '2026-08-10T00:00:00Z' },
      { id: 'q2', format: 'question', created_at: '2026-08-10T00:00:00Z' },
      { id: 'o1', format: 'offer', created_at: '2026-08-10T00:00:00Z' },
      { id: 'o2', format: 'offer', created_at: '2026-08-10T00:00:00Z' },
    ];
    const snaps = [
      snap('q1', 'instagram', '2026-08-22', 10), snap('q2', 'instagram', '2026-08-22', 8),
      snap('o1', 'instagram', '2026-08-22', 2), snap('o2', 'instagram', '2026-08-22', 4),
    ];
    const r = evaluateExperiment(exp, posts, snaps, TZ);
    assert.equal(r.verdict, 'variant');
    assert.equal(r.variant_avg, 9);
    assert.equal(r.control_avg, 3);
  });

  test('posts from before the experiment are excluded', () => {
    const posts = [
      { id: 'old', format: 'question', created_at: '2026-07-01T00:00:00Z' },
    ];
    const snaps = [snap('old', 'instagram', '2026-08-22', 100)];
    const r = evaluateExperiment(exp, posts, snaps, TZ);
    assert.equal(r.verdict, 'insufficient');
  });
});

describe('proposeExperiment', () => {
  test('rotates dimensions: time -> format -> topic -> time', () => {
    const e1 = proposeExperiment({}, null);
    assert.equal(e1.type, 'posting_time');
    const e2 = proposeExperiment({}, e1);
    assert.equal(e2.type, 'format');
    const e3 = proposeExperiment({}, e2);
    assert.equal(e3.type, 'topic');
    const e4 = proposeExperiment({}, e3);
    assert.equal(e4.type, 'posting_time');
  });
  test('every proposal is live with a human description', () => {
    const e = proposeExperiment({ best_hour_local: { hour: 12 } }, null);
    assert.equal(e.status, 'live');
    assert.ok(e.description.length > 5);
    assert.notEqual(String(e.variant), '12'); // tests something different from the current winner
  });
});
