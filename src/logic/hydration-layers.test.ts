/** Run with `npm test` (plain Node test runner, no extra packages). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FILL_CAP,
  HYDRATION_FACTOR,
  MAX_NUDGES_PER_DAY,
  NUDGE_GAP_MS,
  fillLevel,
  hydrationOf,
  isQuietHour,
  mayNudge,
  readNudgeLog,
  totalHydration,
} from './hydration-layers.ts';

const at = (h: number, m = 0) => new Date(2026, 10, 28, h, m, 0);

describe('fillLevel', () => {
  it('is 0 with nothing drunk', () => {
    assert.equal(fillLevel(0, 2000), 0);
  });
  it('is 0.5 at half the goal', () => {
    assert.equal(fillLevel(1000, 2000), 0.5);
  });
  it('is 1 at the goal', () => {
    assert.equal(fillLevel(2000, 2000), 1);
  });
  it('keeps counting past the goal but stops at 120%', () => {
    assert.equal(fillLevel(2200, 2000), 1.1);
    assert.equal(fillLevel(2400, 2000), FILL_CAP);
    assert.equal(fillLevel(9000, 2000), FILL_CAP);
  });
  it('treats broken input safely', () => {
    assert.equal(fillLevel(-50, 2000), 0);
    assert.equal(fillLevel(Number.NaN, 2000), 0);
    assert.equal(fillLevel(250, 0), 1);
    assert.equal(fillLevel(0, 0), 0);
  });
});

describe('drinks', () => {
  it('every factor is 1.0 for now', () => {
    for (const f of Object.values(HYDRATION_FACTOR)) assert.equal(f, 1);
  });
  it('one drink adds ml × factor', () => {
    assert.equal(hydrationOf({ ml: 250, kind: 'water' }), 250);
    assert.equal(hydrationOf({ ml: 330, kind: 'something-new' }), 330); // unknown kinds count in full
    assert.equal(hydrationOf({ ml: -100, kind: 'water' }), 0);
  });
  it('several drinks add up, and the level follows', () => {
    const drinks = [
      { ml: 250, kind: 'water' },
      { ml: 500, kind: 'water' },
      { ml: 250, kind: 'water' },
    ];
    assert.equal(totalHydration(drinks), 1000);
    assert.equal(fillLevel(totalHydration(drinks), 2000), 0.5);
    assert.equal(fillLevel(totalHydration([...drinks, ...drinks, ...drinks]), 2000), FILL_CAP); // 3,000 ml → capped
    assert.equal(totalHydration([]), 0);
  });
});

describe('bowl reminder', () => {
  const empty = readNudgeLog(null, '2026-11-28');
  it('only when behind pace, outside quiet hours', () => {
    assert.equal(mayNudge(true, at(14), empty), true);
    assert.equal(mayNudge(false, at(14), empty), false);
    assert.equal(mayNudge(true, at(8, 59), empty), false);
    assert.equal(mayNudge(true, at(21), empty), false);
    assert.equal(isQuietHour(at(23)), true);
    assert.equal(isQuietHour(at(12)), false);
  });
  it('at most three a day, at least 90 minutes apart', () => {
    const last = at(12).getTime();
    assert.equal(mayNudge(true, at(13), { day: '2026-11-28', count: 1, lastAt: last }), false);
    assert.equal(mayNudge(true, new Date(last + NUDGE_GAP_MS), { day: '2026-11-28', count: 1, lastAt: last }), true);
    assert.equal(mayNudge(true, at(20), { day: '2026-11-28', count: MAX_NUDGES_PER_DAY, lastAt: last }), false);
  });
  it("yesterday's count doesn't carry over, and bad saves read as empty", () => {
    assert.deepEqual(readNudgeLog(JSON.stringify({ day: '2026-11-27', count: 3, lastAt: 5 }), '2026-11-28'), empty);
    assert.deepEqual(readNudgeLog('not json', '2026-11-28'), empty);
    assert.deepEqual(readNudgeLog(JSON.stringify({ day: '2026-11-28', count: 2, lastAt: 7 }), '2026-11-28'), { day: '2026-11-28', count: 2, lastAt: 7 });
  });
});
