/** Run with `npm test` (plain Node test runner, no extra packages). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dayFraction, fmtMl, waterGoalMl, waterPace } from './hydration.ts';

const at = (h: number, m = 0) => new Date(2026, 10, 26, h, m, 0);

describe('waterGoalMl', () => {
  it('uses weight × 33 ml, rounded to 50', () => {
    assert.equal(waterGoalMl(70), 2300); // 2310 → 2300
    assert.equal(waterGoalMl(80), 2650); // 2640 → 2650
  });
  it('adds 500 ml per hour of exercise', () => {
    assert.equal(waterGoalMl(70, 60), 2800); // 2310 + 500
    assert.equal(waterGoalMl(70, 30), 2550); // 2310 + 250 = 2560 → 2550
  });
  it('falls back to 2,000 ml without a weight', () => {
    assert.equal(waterGoalMl(null), 2000);
    assert.equal(waterGoalMl(0), 2000);
    assert.equal(waterGoalMl(undefined, 60), 2500);
  });
  it('clamps to 1,500–5,000 ml', () => {
    assert.equal(waterGoalMl(30), 1500); // 990
    assert.equal(waterGoalMl(150, 240), 5000); // 4950 + 2000
  });
  it('ignores negative exercise', () => {
    assert.equal(waterGoalMl(70, -30), 2300);
  });
});

describe('dayFraction', () => {
  it('is 0 before 7:00 and 1 after 21:00', () => {
    assert.equal(dayFraction(at(6)), 0);
    assert.equal(dayFraction(at(22)), 1);
  });
  it('is halfway at 14:00', () => {
    assert.equal(dayFraction(at(14)), 0.5);
  });
});

describe('waterPace', () => {
  it('is on pace near the expected amount', () => {
    const p = waterPace(1000, 2000, at(14));
    assert.equal(p.expectedMl, 1000);
    assert.equal(p.status, 'on');
  });
  it('is behind when well under', () => {
    const p = waterPace(500, 2000, at(14));
    assert.equal(p.status, 'behind');
    assert.match(p.line, /500 ml behind/);
  });
  it('is ahead when well over', () => {
    assert.equal(waterPace(1500, 2000, at(14)).status, 'ahead');
  });
  it('is done once the goal is reached', () => {
    assert.equal(waterPace(2000, 2000, at(9)).status, 'done');
  });
  it('is on pace early in the morning with nothing yet', () => {
    assert.equal(waterPace(0, 2000, at(6, 30)).status, 'on');
  });
});

describe('fmtMl', () => {
  it('adds thousands separators', () => {
    assert.equal(fmtMl(1250), '1,250');
    assert.equal(fmtMl(250), '250');
  });
});
