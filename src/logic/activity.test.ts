import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeLog, groupLogs } from './activity.ts';

const log = (id: number, activity: string, amount: number, unit: 'min' | 'reps', at: number) => ({
  id,
  activity,
  name: activity === 'walk' ? 'Walk' : activity === 'squats' ? 'Squats' : 'Yoga',
  amount,
  unit,
  loggedAt: at,
});

describe('groupLogs', () => {
  it('combines the same activity into one entry with the total', () => {
    const g = groupLogs([log(1, 'walk', 20, 'min', 100), log(2, 'yoga', 10, 'min', 200), log(3, 'walk', 20, 'min', 300)]);
    assert.equal(g.length, 2);
    assert.equal(describeLog(g[0].name, g[0].amount, g[0].unit), '40 min walk');
    assert.deepEqual(g[0].logs.map((l) => l.id), [1, 3]);
    assert.equal(describeLog(g[1].name, g[1].amount, g[1].unit), '10 min yoga');
  });
  it('orders by first log of the day, whatever the input order', () => {
    const g = groupLogs([log(3, 'yoga', 5, 'min', 300), log(1, 'walk', 10, 'min', 100)]);
    assert.deepEqual(g.map((x) => x.activity), ['walk', 'yoga']);
  });
  it('keeps reps and minutes apart', () => {
    assert.equal(groupLogs([log(1, 'squats', 15, 'reps', 1), log(2, 'squats', 2, 'min', 2)]).length, 2);
  });
  it('handles no logs', () => {
    assert.deepEqual(groupLogs([]), []);
  });
});
