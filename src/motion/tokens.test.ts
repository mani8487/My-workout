import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AMBIENT, ARC, CELEBRATE, DURATION, SHAPE, WAKE, pick } from './tokens.ts';

test('duration bands stay inside the motion spec', () => {
  for (const ms of Object.values(DURATION.micro)) assert.ok(ms >= 150 && ms <= 250, `micro ${ms}`);
  for (const ms of Object.values(DURATION.transition)) assert.ok(ms >= 350 && ms <= 700, `transition ${ms}`);
  for (const ms of Object.values(DURATION.ambient)) assert.ok(ms >= 3000 && ms <= 8000, `ambient ${ms}`);
});

test('every ambient range is positive and non-empty, so loops always vary', () => {
  for (const [name, r] of Object.entries(AMBIENT)) {
    assert.ok(r.min > 0, `${name} min`);
    assert.ok(r.max > r.min, `${name} has no spread`);
  }
});

test('arcs: falling is no slower than rising, both quick', () => {
  for (const a of Object.values(ARC)) {
    assert.ok(a.fall <= a.rise);
    assert.ok(a.rise + a.fall <= DURATION.transition.long);
  }
});

test('pick maps 0..1 onto the range and clamps bad input', () => {
  const r = { min: 100, max: 200 };
  assert.equal(pick(r, 0), 100);
  assert.equal(pick(r, 1), 200);
  assert.equal(pick(r, 0.5), 150);
  assert.equal(pick(r, -3), 100);
  assert.equal(pick(r, 7), 200);
});

test('waking beats run in order: eyes, stretch, crouch, hop, land', () => {
  assert.ok(WAKE.eyesOpen < WAKE.stretch);
  assert.ok(WAKE.stretch < WAKE.crouch && WAKE.crouch < WAKE.hop && WAKE.hop < WAKE.land);
  assert.equal(WAKE.land - WAKE.hop, ARC.hop.rise + ARC.hop.fall);
});

test('celebration lands after crouch and take-off', () => {
  assert.ok(CELEBRATE.land > CELEBRATE.crouch + CELEBRATE.takeoff);
});

test('squash and stretch roughly keep volume (area within 5%)', () => {
  for (const [name, s] of Object.entries(SHAPE)) assert.ok(Math.abs(s.x * s.y - 1) <= 0.05, name);
});
