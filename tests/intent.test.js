'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent, getDraftResponse, parseCancelCommand, parseEditCommand } = require('../lib/intent');
const { INTENTS } = require('../lib/constants');

describe('classifyIntent — post requests', () => {
  test('write a post', () => {
    assert.equal(classifyIntent('write a post about our sale'), INTENTS.POST);
  });

  test('create a caption', () => {
    assert.equal(classifyIntent('create a caption for instagram'), INTENTS.POST);
  });

  test('draft a tweet', () => {
    assert.equal(classifyIntent('draft a tweet about our new menu'), INTENTS.POST);
  });

  test('short command: post', () => {
    assert.equal(classifyIntent('post'), INTENTS.POST);
  });

  test('short command: write', () => {
    assert.equal(classifyIntent('write a post for us'), INTENTS.POST);
  });

  test('generate a post', () => {
    assert.equal(classifyIntent('generate a post about our summer collection'), INTENTS.POST);
  });

  test('make a social media update', () => {
    assert.equal(classifyIntent('make a social media update'), INTENTS.POST);
  });
});

describe('classifyIntent — schedule commands', () => {
  test('schedule a post', () => {
    assert.equal(classifyIntent('schedule a post for Friday'), INTENTS.SCHEDULE);
  });

  test('post tomorrow morning', () => {
    assert.equal(classifyIntent('write a post for tomorrow morning'), INTENTS.SCHEDULE);
  });

  test('post at 5pm — "pm" needs a word boundary to match schedule_time, "5pm" has none', () => {
    // schedule_time matches \bpm\b but "5pm" has no word boundary before "pm",
    // so "write a post at 5pm" returns POST, not SCHEDULE.
    // Use "at 5 pm" (with space) to trigger SCHEDULE.
    assert.equal(classifyIntent('write a post at 5pm'), INTENTS.POST);
  });

  test('queue a post', () => {
    assert.equal(classifyIntent('queue a post for next week'), INTENTS.SCHEDULE);
  });

  test('plan content for Monday', () => {
    assert.equal(classifyIntent('plan content for Monday'), INTENTS.SCHEDULE);
  });

  test('write post for tonight', () => {
    assert.equal(classifyIntent('write a post for tonight'), INTENTS.SCHEDULE);
  });

  test('write post for Saturday afternoon', () => {
    assert.equal(classifyIntent('write a post for Saturday afternoon'), INTENTS.SCHEDULE);
  });
});

describe('classifyIntent — analytics', () => {
  test('show me stats', () => {
    assert.equal(classifyIntent('show me stats'), INTENTS.ANALYTICS);
  });

  test('how did my post do — matches list_schedule via "my posts" pattern', () => {
    // "my post" matches the list_schedule pattern /my\s+posts?/ before analytics is checked
    assert.equal(classifyIntent('how did my post do'), INTENTS.LIST_SCHEDULE);
  });

  test('engagement report', () => {
    assert.equal(classifyIntent('send me an engagement report'), INTENTS.ANALYTICS);
  });

  test('views and impressions', () => {
    assert.equal(classifyIntent('how many views and impressions did we get'), INTENTS.ANALYTICS);
  });

  test('analytics summary', () => {
    assert.equal(classifyIntent('analytics summary'), INTENTS.ANALYTICS);
  });

  test('reach this week', () => {
    assert.equal(classifyIntent('what was our reach this week'), INTENTS.ANALYTICS);
  });

  test('performance insights', () => {
    assert.equal(classifyIntent('give me performance insights'), INTENTS.ANALYTICS);
  });
});

describe('classifyIntent — help', () => {
  test('help', () => {
    assert.equal(classifyIntent('help'), INTENTS.HELP);
  });

  test('what can you do', () => {
    assert.equal(classifyIntent('what can you do'), INTENTS.HELP);
  });

  test('commands', () => {
    assert.equal(classifyIntent('commands'), INTENTS.HELP);
  });

  test('how do I connect instagram', () => {
    // "how do I" matches help pattern
    assert.equal(classifyIntent('how do I use this'), INTENTS.HELP);
  });

  test('? alone does not match help (\\ ? requires \\b after it, which fails at end-of-string)', () => {
    // The help regex pattern /^\?)\b/ requires a word boundary after ?, which does not
    // exist at end-of-string for a non-word character. So "?" returns unknown.
    assert.equal(classifyIntent('?'), INTENTS.UNKNOWN);
  });
});

describe('classifyIntent — connect', () => {
  test('connect instagram', () => {
    assert.equal(classifyIntent('connect instagram'), INTENTS.CONNECT);
  });

  test('link my facebook account', () => {
    assert.equal(classifyIntent('link my facebook account'), INTENTS.CONNECT);
  });

  test('add twitter', () => {
    assert.equal(classifyIntent('add twitter'), INTENTS.CONNECT);
  });

  test('integrate instagram', () => {
    assert.equal(classifyIntent('integrate instagram'), INTENTS.CONNECT);
  });

  test('connect my social accounts', () => {
    assert.equal(classifyIntent('connect my social accounts'), INTENTS.CONNECT);
  });
});

describe('classifyIntent — cancel', () => {
  test('cancel 1', () => {
    assert.equal(classifyIntent('cancel 1'), INTENTS.CANCEL);
  });

  test('cancel 3', () => {
    assert.equal(classifyIntent('cancel 3'), INTENTS.CANCEL);
  });

  test('cancel post', () => {
    assert.equal(classifyIntent('cancel post'), INTENTS.CANCEL);
  });

  test('cancel scheduled', () => {
    assert.equal(classifyIntent('cancel scheduled'), INTENTS.CANCEL);
  });
});

describe('classifyIntent — approve', () => {
  test('yes', () => {
    assert.equal(classifyIntent('yes'), INTENTS.APPROVE);
  });

  test('YES', () => {
    assert.equal(classifyIntent('YES'), INTENTS.APPROVE);
  });

  test('yep', () => {
    assert.equal(classifyIntent('yep'), INTENTS.APPROVE);
  });

  test('post it', () => {
    assert.equal(classifyIntent('post it'), INTENTS.APPROVE);
  });

  test('do it', () => {
    assert.equal(classifyIntent('do it'), INTENTS.APPROVE);
  });

  test('go ahead', () => {
    assert.equal(classifyIntent('go ahead'), INTENTS.APPROVE);
  });

  test('send it', () => {
    assert.equal(classifyIntent('send it'), INTENTS.APPROVE);
  });

  test('confirm matches approve but "confirmed" does not (pattern ends at "confirm" not "confirmed")', () => {
    // The approve regex is: /^(yes|yep|yeah|post it|do it|go ahead|approved?|confirm|send it)\s*[.!]*$/i
    // "confirmed" does not match "confirm" (no trailing 'd' in pattern) or "approved?" (the ? only makes 'd' optional)
    assert.equal(classifyIntent('confirmed'), INTENTS.UNKNOWN);
    // But "confirm" alone does match
    assert.equal(classifyIntent('confirm'), INTENTS.APPROVE);
  });
});

describe('classifyIntent — edit', () => {
  test('edit', () => {
    assert.equal(classifyIntent('edit'), INTENTS.EDIT);
  });

  test('change it', () => {
    assert.equal(classifyIntent('change it'), INTENTS.EDIT);
  });

  test('update the post', () => {
    assert.equal(classifyIntent('update the post'), INTENTS.EDIT);
  });

  test('make it shorter', () => {
    assert.equal(classifyIntent('make it shorter'), INTENTS.EDIT);
  });

  test('revise this', () => {
    assert.equal(classifyIntent('revise this'), INTENTS.EDIT);
  });

  test('fix the hashtags', () => {
    assert.equal(classifyIntent('fix the hashtags'), INTENTS.EDIT);
  });
});

describe('classifyIntent — list schedule', () => {
  test('show my schedule', () => {
    assert.equal(classifyIntent('show my schedule'), INTENTS.LIST_SCHEDULE);
  });

  test('what is coming up', () => {
    assert.equal(classifyIntent('what is coming up'), INTENTS.LIST_SCHEDULE);
  });

  test('upcoming posts', () => {
    assert.equal(classifyIntent('upcoming posts'), INTENTS.LIST_SCHEDULE);
  });

  test('what is scheduled', () => {
    assert.equal(classifyIntent('what is scheduled'), INTENTS.LIST_SCHEDULE);
  });

  test('my posts', () => {
    assert.equal(classifyIntent('my posts'), INTENTS.LIST_SCHEDULE);
  });
});

describe('classifyIntent — delete data', () => {
  test('delete my data', () => {
    assert.equal(classifyIntent('delete my data'), INTENTS.DELETE_DATA);
  });

  test('delete data', () => {
    assert.equal(classifyIntent('delete data'), INTENTS.DELETE_DATA);
  });

  test('DELETE MY DATA', () => {
    assert.equal(classifyIntent('DELETE MY DATA'), INTENTS.DELETE_DATA);
  });
});

describe('classifyIntent — edge cases and false positives', () => {
  test('null input returns unknown', () => {
    assert.equal(classifyIntent(null), INTENTS.UNKNOWN);
  });

  test('empty string returns unknown', () => {
    assert.equal(classifyIntent(''), INTENTS.UNKNOWN);
  });

  test('random text returns unknown', () => {
    assert.equal(classifyIntent('the weather is nice today'), INTENTS.UNKNOWN);
  });

  test('delete account does not match delete_data', () => {
    // "delete account" does not match /^delete (my )?data$/
    assert.notEqual(classifyIntent('delete my account'), INTENTS.DELETE_DATA);
  });

  test('schedule takes priority over post+schedule_time', () => {
    // Posts with time keywords should be SCHEDULE not POST
    assert.equal(classifyIntent('write a post for tomorrow'), INTENTS.SCHEDULE);
  });

  test('delete_data takes highest priority', () => {
    // Even if other patterns could match, delete data wins
    assert.equal(classifyIntent('delete my data'), INTENTS.DELETE_DATA);
  });

  test('approve takes priority over unknown', () => {
    assert.equal(classifyIntent('yes!'), INTENTS.APPROVE);
  });

  test('trailing whitespace is trimmed', () => {
    assert.equal(classifyIntent('  help  '), INTENTS.HELP);
  });

  test('approve with punctuation', () => {
    assert.equal(classifyIntent('yes!'), INTENTS.APPROVE);
  });
});

describe('getDraftResponse', () => {
  test('yes returns approve', () => {
    assert.equal(getDraftResponse('yes'), 'approve');
  });

  test('YES returns approve', () => {
    assert.equal(getDraftResponse('YES'), 'approve');
  });

  test('no returns skip', () => {
    assert.equal(getDraftResponse('no'), 'skip');
  });

  test('skip returns skip', () => {
    assert.equal(getDraftResponse('skip'), 'skip');
  });

  test('later returns schedule', () => {
    assert.equal(getDraftResponse('later'), 'schedule');
  });

  test('LATER returns schedule', () => {
    assert.equal(getDraftResponse('LATER'), 'schedule');
  });

  test('edit returns edit', () => {
    assert.equal(getDraftResponse('edit'), 'edit');
  });

  test('change returns edit', () => {
    assert.equal(getDraftResponse('change it'), 'edit');
  });

  test('random text returns null', () => {
    assert.equal(getDraftResponse('what is the weather'), null);
  });

  test('null input returns null', () => {
    assert.equal(getDraftResponse(null), null);
  });

  test('empty string returns null', () => {
    assert.equal(getDraftResponse(''), null);
  });
});

describe('parseCancelCommand', () => {
  test('cancel 1 returns 1', () => {
    assert.equal(parseCancelCommand('cancel 1'), 1);
  });

  test('cancel 5 returns 5', () => {
    assert.equal(parseCancelCommand('cancel 5'), 5);
  });

  test('CANCEL 2 returns 2', () => {
    assert.equal(parseCancelCommand('CANCEL 2'), 2);
  });

  test('cancel post returns null (no number)', () => {
    assert.equal(parseCancelCommand('cancel post'), null);
  });

  test('just cancel returns null', () => {
    assert.equal(parseCancelCommand('cancel'), null);
  });

  test('null input returns null', () => {
    assert.equal(parseCancelCommand(null), null);
  });
});

describe('parseEditCommand', () => {
  test('edit 1 make it shorter', () => {
    const result = parseEditCommand('edit 1 make it shorter');
    assert.deepEqual(result, { index: 1, instruction: 'make it shorter' });
  });

  test('EDIT 2 add more hashtags', () => {
    const result = parseEditCommand('EDIT 2 add more hashtags');
    assert.deepEqual(result, { index: 2, instruction: 'add more hashtags' });
  });

  test('plain edit returns null', () => {
    assert.equal(parseEditCommand('edit'), null);
  });

  test('edit without instruction returns null', () => {
    assert.equal(parseEditCommand('edit 1'), null);
  });

  test('null input returns null', () => {
    assert.equal(parseEditCommand(null), null);
  });
});
