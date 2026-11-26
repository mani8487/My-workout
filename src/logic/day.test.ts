import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { catchUpFrom, dayKeyOf, encodeLastSeen, msUntilNextMidnight } from './day.ts';

describe('day rollover', () => {
  it('day key is the local calendar day', () => {
    assert.equal(dayKeyOf(new Date(2026, 10, 26, 23, 59)), '2026-11-26');
    assert.equal(dayKeyOf(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
  });
  it('time to midnight', () => {
    assert.equal(msUntilNextMidnight(new Date(2026, 10, 26, 23, 59, 0)), 60_000);
    assert.equal(msUntilNextMidnight(new Date(2026, 10, 26, 0, 0, 0)), 86_400_000);
    // Month and year ends roll over.
    assert.equal(msUntilNextMidnight(new Date(2026, 11, 31, 23, 0, 0)), 3_600_000);
  });
  it('the next day key comes exactly at midnight', () => {
    const now = new Date(2026, 10, 26, 18, 30);
    const after = new Date(now.getTime() + msUntilNextMidnight(now));
    assert.equal(dayKeyOf(after), '2026-11-27');
    const before = new Date(after.getTime() - 1);
    assert.equal(dayKeyOf(before), '2026-11-26');
  });
});

describe('catch-up start', () => {
  const today = '2026-11-26';
  it('resumes from what was seen earlier today', () => {
    assert.deepEqual(catchUpFrom(encodeLastSeen({ day: today, stage: 1.2, water: 0.4 }), today), { stage: 1.2, water: 0.4 });
  });
  it('starts from the empty morning room on a new day', () => {
    assert.deepEqual(catchUpFrom(encodeLastSeen({ day: '2026-11-25', stage: 2, water: 1 }), today), { stage: 0, water: 0 });
  });
  it('ignores missing, broken or out-of-range values', () => {
    assert.deepEqual(catchUpFrom(null, today), { stage: 0, water: 0 });
    assert.deepEqual(catchUpFrom('not json', today), { stage: 0, water: 0 });
    assert.deepEqual(catchUpFrom(JSON.stringify({ day: today, stage: 9, water: -3 }), today), { stage: 2, water: 0 });
    assert.deepEqual(catchUpFrom(JSON.stringify({ day: today, stage: 'x' }), today), { stage: 0, water: 0 });
  });
});
