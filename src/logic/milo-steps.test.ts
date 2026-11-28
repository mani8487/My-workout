/** Run with `npm test` (plain Node test runner, no extra packages). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CADENCE,
  CADENCE_WINDOW_MS,
  REPLAY,
  SLICE_MIN,
  SLICE_MS,
  badgeLabel,
  badgeOf,
  cadenceOf,
  energyOf,
  energyToday,
  gaitLevel,
  gaitOf,
  milestonesCrossed,
  nextGait,
  readSlices,
  readStepsSeen,
  recapLine,
  replayLine,
  replayPlan,
  sliceGait,
  sliceIndex,
  summarize,
  trimSamples,
} from './milo-steps.ts';

describe('gaitOf (cadence classification)', () => {
  it('idle below 20 steps a minute', () => {
    assert.equal(gaitOf(0), 'idle');
    assert.equal(gaitOf(19.9), 'idle');
    assert.equal(gaitOf(Number.NaN), 'idle');
  });
  it('walk from 20 up to 130', () => {
    assert.equal(gaitOf(CADENCE.walkFrom), 'walk');
    assert.equal(gaitOf(100), 'walk');
    assert.equal(gaitOf(129.9), 'walk');
  });
  it('run from 130', () => {
    assert.equal(gaitOf(CADENCE.runFrom), 'run');
    assert.equal(gaitOf(180), 'run');
  });
  it('levels for the renderer', () => {
    assert.deepEqual(['idle', 'walk', 'run'].map((g) => gaitLevel(g as 'idle')), [0, 1, 2]);
  });
});

describe('nextGait (live, with hysteresis)', () => {
  it('starts a gait at the usual thresholds', () => {
    assert.equal(nextGait('idle', 19), 'idle');
    assert.equal(nextGait('idle', 20), 'walk');
    assert.equal(nextGait('idle', 140), 'run');
    assert.equal(nextGait('walk', 134), 'walk');
    assert.equal(nextGait('walk', 135), 'run');
  });
  it('keeps a gait until the cadence falls clearly below it', () => {
    assert.equal(nextGait('run', 126), 'run');
    assert.equal(nextGait('run', 124), 'walk');
    assert.equal(nextGait('walk', 16), 'walk');
    assert.equal(nextGait('walk', 14), 'idle');
    assert.equal(nextGait('run', 0), 'idle');
    assert.equal(nextGait('walk', Number.NaN), 'idle');
  });
  it('a brisk walk wobbling around 130 stays a trot', () => {
    let g = nextGait('idle', 128);
    for (const spm of [131, 127, 133, 129, 132]) g = nextGait(g, spm);
    assert.equal(g, 'walk');
  });
});

describe('cadenceOf', () => {
  const now = 100_000;
  it('is 0 with no samples or no new steps', () => {
    assert.equal(cadenceOf([], now), 0);
    assert.equal(cadenceOf([{ t: now - 5_000, steps: 40 }, { t: now - 1_000, steps: 40 }], now), 0);
  });
  it('measures over the whole window when a sample before it is known', () => {
    // 20 steps in the 10 s window = 120 a minute.
    const s = [{ t: now - 12_000, steps: 100 }, { t: now - 4_000, steps: 110 }, { t: now - 1_000, steps: 120 }];
    assert.equal(cadenceOf(s, now), 120);
  });
  it('measures over the time seen when watching just began', () => {
    // 10 steps over the 5 s since the first sample = 120 a minute.
    const s = [{ t: now - 5_000, steps: 0 }, { t: now - 1_000, steps: 10 }];
    assert.equal(cadenceOf(s, now), 120);
  });
  it('drops to 0 once the steps are older than the window', () => {
    const s = [{ t: now - 30_000, steps: 0 }, { t: now - 20_000, steps: 30 }];
    assert.equal(cadenceOf(s, now), 0);
  });
  it('trimSamples keeps one sample before the window and everything in it', () => {
    const s = [{ t: now - 30_000, steps: 0 }, { t: now - 15_000, steps: 10 }, { t: now - 5_000, steps: 20 }];
    assert.deepEqual(trimSamples(s, now), s.slice(1));
    assert.equal(cadenceOf(trimSamples(s, now), now), cadenceOf(s, now));
    assert.ok(CADENCE_WINDOW_MS === 10_000);
  });
});

describe('slices (catch-up classification)', () => {
  it('classifies by steps per minute', () => {
    assert.equal(sliceGait(0), 'idle');
    assert.equal(sliceGait(99), 'idle'); // 19.8 a minute
    assert.equal(sliceGait(100), 'walk'); // 20 a minute
    assert.equal(sliceGait(649), 'walk');
    assert.equal(sliceGait(650), 'run'); // 130 a minute
  });
  it('summarizes steps and minutes', () => {
    assert.deepEqual(summarize([0, 500, 500, 800, 10, -5]), { steps: 1810, walkMin: 2 * SLICE_MIN, runMin: SLICE_MIN });
    assert.deepEqual(summarize([]), { steps: 0, walkMin: 0, runMin: 0 });
  });
  it('finds the slice for a time', () => {
    assert.equal(sliceIndex(0, 0), 0);
    assert.equal(sliceIndex(SLICE_MS - 1, 0), 0);
    assert.equal(sliceIndex(SLICE_MS, 0), 1);
    assert.equal(sliceIndex(-10, 0), 0);
  });
});

describe('replayPlan', () => {
  it('is empty without activity', () => {
    assert.deepEqual(replayPlan([0, 10, 50]), []);
  });
  it('trots, then runs, inside 3–5 s', () => {
    const plan = replayPlan([500, 500, 500, 800]);
    assert.deepEqual(plan.map((p) => p.gait), ['walk', 'run']);
    const total = plan.reduce((t, p) => t + p.ms, 0);
    assert.ok(total >= REPLAY.minMs && total <= REPLAY.maxMs, String(total));
    assert.ok(plan.every((p) => p.ms >= 1_000));
  });
  it('a long day replays for the full 5 s, a short one for 3 s', () => {
    const long = replayPlan(new Array(20).fill(500));
    assert.equal(long[0].ms, REPLAY.maxMs);
    const short = replayPlan([500]);
    assert.ok(short[0].ms >= REPLAY.minMs && short[0].ms < REPLAY.minMs + 200);
  });
  it('only a run when there was no walking', () => {
    assert.deepEqual(replayPlan([700]).map((p) => p.gait), ['run']);
  });
});

describe('lines', () => {
  it('replay line', () => {
    assert.equal(replayLine(4200, [500, 500, 800]), 'You walked 4,200 steps. Milo trotted 10 min and ran 5 min.');
    assert.equal(replayLine(150, [0]), 'You walked 150 steps.');
  });
  it('recap line', () => {
    assert.equal(recapLine(8400), 'Milo got fitter today: 8,400 steps');
  });
});

describe('energy', () => {
  it('builds from steps and minutes, capped at 100', () => {
    assert.equal(energyOf(0, 0), 0);
    assert.equal(energyOf(5_000, 0), 35);
    assert.equal(energyOf(0, 15), 15);
    assert.equal(energyOf(10_000, 30), 100);
    assert.equal(energyOf(30_000, 300), 100);
    assert.equal(energyOf(-5, -5), 0);
  });
  it('never drops during the day, and starts fresh on a new day', () => {
    const saved = JSON.stringify({ day: '2026-11-28', value: 60 });
    assert.equal(energyToday(40, saved, '2026-11-28'), 60);
    assert.equal(energyToday(70, saved, '2026-11-28'), 70);
    assert.equal(energyToday(10, saved, '2026-11-29'), 10);
    assert.equal(energyToday(10, 'not json', '2026-11-29'), 10);
  });
});

describe('milestones', () => {
  it('reports each one crossed once', () => {
    assert.deepEqual(milestonesCrossed(4_900, 5_100), [5_000]);
    assert.deepEqual(milestonesCrossed(4_000, 10_500), [5_000, 8_000, 10_000]);
    assert.deepEqual(milestonesCrossed(5_000, 6_000), []);
  });
  it('badge is the highest reached', () => {
    assert.equal(badgeOf(4_999), null);
    assert.equal(badgeOf(8_200), 8_000);
    assert.equal(badgeLabel(10_000), '10k');
  });
});

describe('saved values', () => {
  it('reads what was seen today only', () => {
    const v = JSON.stringify({ day: 'd1', steps: 300, at: 5 });
    assert.deepEqual(readStepsSeen(v, 'd1'), { day: 'd1', steps: 300, at: 5 });
    assert.equal(readStepsSeen(v, 'd2'), null);
    assert.equal(readStepsSeen('{', 'd1'), null);
  });
  it('reads cached slices for today only', () => {
    const v = JSON.stringify({ day: 'd1', slices: [1, 2] });
    assert.deepEqual(readSlices(v, 'd1'), [1, 2]);
    assert.deepEqual(readSlices(v, 'd2'), []);
    assert.deepEqual(readSlices(JSON.stringify({ day: 'd1', slices: ['x'] }), 'd1'), []);
  });
});
