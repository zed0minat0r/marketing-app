'use strict';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');

const { STARS, listUnansweredReviews } = require('../lib/review-replies');
const { classifyIntent } = require('../lib/intent');
const { INTENTS } = require('../lib/constants');

describe('star rating mapping', () => {
  test('maps GBP enum names to numbers', () => {
    assert.equal(STARS.ONE, 1);
    assert.equal(STARS.FIVE, 5);
    assert.equal(STARS.NOPE, undefined);
  });
});

describe('listUnansweredReviews', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('filters out reviews that already have an owner reply, maps fields, limits', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        reviews: [
          { name: 'accounts/1/locations/2/reviews/a', reviewer: { displayName: 'Ann' }, starRating: 'FIVE', comment: 'Great work!' },
          { name: 'accounts/1/locations/2/reviews/b', reviewer: { displayName: 'Bob' }, starRating: 'TWO', comment: 'Slow.', reviewReply: { comment: 'already replied' } },
          { name: 'accounts/1/locations/2/reviews/c', reviewer: { displayName: 'Cal' }, starRating: 'FOUR' },
        ],
      }),
    });
    const { reviews } = await listUnansweredReviews('tok', 'accounts/1/locations/2', 5);
    assert.equal(reviews.length, 2);
    assert.deepEqual(reviews[0], { reviewId: 'accounts/1/locations/2/reviews/a', reviewer: 'Ann', stars: 5, text: 'Great work!' });
    assert.equal(reviews[1].stars, 4);
    assert.equal(reviews[1].text, ''); // rating-only review
  });

  test('reports API errors without throwing', async () => {
    global.fetch = async () => ({ ok: false, status: 403 });
    const r = await listUnansweredReviews('tok', 'accounts/1/locations/2');
    assert.equal(r.error, 'HTTP 403');
    assert.deepEqual(r.reviews, []);
  });
});

describe('check_reviews intent', () => {
  test('review phrasings classify to CHECK_REVIEWS', () => {
    assert.equal(classifyIntent('check my reviews'), INTENTS.CHECK_REVIEWS);
    assert.equal(classifyIntent('any new reviews?'), INTENTS.CHECK_REVIEWS);
    assert.equal(classifyIntent('reviews'), INTENTS.CHECK_REVIEWS);
  });
  test('does not swallow website audit or ordinary sentences', () => {
    assert.equal(classifyIntent('check my website'), INTENTS.WEBSITE_AUDIT);
    assert.equal(classifyIntent('audit my site'), INTENTS.WEBSITE_AUDIT);
    assert.notEqual(classifyIntent('review my website'), INTENTS.CHECK_REVIEWS);
    assert.notEqual(classifyIntent('write a post about our great reviews from customers'), INTENTS.CHECK_REVIEWS);
  });
});
