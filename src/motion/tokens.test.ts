import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AMBIENT, ARC, CAMEO, CELEBRATE, DURATION, LEAVE, SHAPE, TRIP, WAKE, cameoLength, pick } from './tokens.ts';

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

test('the start transition fits the 600-800 ms window', () => {
  assert.ok(LEAVE.perk < LEAVE.crouch && LEAVE.crouch < LEAVE.takeoff);
  const landed = LEAVE.takeoff + ARC.leap.rise + ARC.leap.fall;
  const settled = landed + DURATION.micro.fast; // the landing squash
  const screenIn = TRIP.navigate + TRIP.screenFade;
  assert.ok(settled <= 800, `milo settles at ${settled}`);
  assert.ok(screenIn >= 600 && screenIn <= 800, `screen ${screenIn}`);
  // In order: perk, hop, the room leaves as he comes down, then the workout screen.
  assert.ok(TRIP.roomOut > LEAVE.takeoff && TRIP.roomOut < landed);
  assert.ok(TRIP.navigate >= TRIP.roomOut && TRIP.navigate < landed + DURATION.micro.fast);
  assert.ok(TRIP.roomOut + DURATION.transition.short <= 800);
});

test('every cameo lasts 1.5–2.5 s, including its final settle', () => {
  for (const kind of ['stretch', 'walk', 'run', 'squat'] as const) {
    const total = cameoLength(kind) + DURATION.transition.short; // the final settle spring (perceptual length)
    assert.ok(cameoLength(kind) >= 1500 && total <= 2500, `${kind}: ${cameoLength(kind)} + settle`);
  }
  assert.ok(CAMEO.still >= 1500 && CAMEO.still <= 2500);
  // Walk alternates a paw step with a weight shift, so it needs an even number of steps.
  assert.equal(CAMEO.walk.steps % 2, 0);
});
