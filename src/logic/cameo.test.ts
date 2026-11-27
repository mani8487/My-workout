import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTIVITY_PRESETS } from './activity.ts';
import { cameoFor, enqueueCameos, MAX_QUEUED } from './cameo.ts';

describe('cameoFor', () => {
  it('maps the four built cameos', () => {
    assert.equal(cameoFor('yoga'), 'stretch');
    assert.equal(cameoFor('stretch'), 'stretch');
    assert.equal(cameoFor('walk'), 'walk');
    assert.equal(cameoFor('run'), 'run');
    assert.equal(cameoFor('squats'), 'squat');
  });
  it('gives every Quick Log preset a cameo, and unknown ones a gentle walk', () => {
    for (const p of ACTIVITY_PRESETS) assert.ok(['stretch', 'walk', 'run', 'squat'].includes(cameoFor(p.id)), p.id);
    assert.equal(cameoFor('something-new'), 'walk');
  });
});

describe('enqueueCameos', () => {
  it('queues different cameos in order', () => {
    assert.deepEqual(enqueueCameos([], ['walk', 'run'], null), ['walk', 'run']);
  });
  it('collapses the same cameo logged twice in a row', () => {
    assert.deepEqual(enqueueCameos([], ['walk', 'walk', 'walk'], null), ['walk']);
    assert.deepEqual(enqueueCameos(['walk'], ['walk'], null), ['walk']);
  });
  it("doesn't repeat the cameo that's playing right now", () => {
    assert.deepEqual(enqueueCameos([], ['squat'], 'squat'), []);
    assert.deepEqual(enqueueCameos([], ['squat', 'walk'], 'squat'), ['walk']);
  });
  it('accepts the playing kind again once something else is waiting', () => {
    assert.deepEqual(enqueueCameos(['run'], ['walk'], 'walk'), ['run', 'walk']);
  });
  it('the cap still drops new kinds after a skipped duplicate', () => {
    assert.deepEqual(enqueueCameos(['walk', 'run'], ['run', 'squat', 'stretch'], null), ['walk', 'run', 'squat']);
  });
  it('never lets the line grow past the limit', () => {
    const q = enqueueCameos([], ['walk', 'run', 'squat', 'stretch', 'walk'], null);
    assert.equal(q.length, MAX_QUEUED);
    assert.deepEqual(q, ['walk', 'run', 'squat']);
    assert.deepEqual(enqueueCameos(q, ['stretch'], 'walk'), q);
  });
  it('does not change the queue it was given', () => {
    const q = ['walk'] as const;
    enqueueCameos(q, ['run'], null);
    assert.deepEqual(q, ['walk']);
  });
});
