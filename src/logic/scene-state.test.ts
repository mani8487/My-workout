import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awakeAt,
  CURTAINS_RESTING,
  curtainsOpen,
  daylight,
  describeScene,
  dimness,
  DUST_MAX,
  dustCount,
  lampOn,
  minutesText,
  moodOf,
  moteOpacity,
  ratio,
  sceneTarget,
  stageOf,
  warmth,
} from './scene-state.ts';

describe('ratio', () => {
  it('clamps to 0–1', () => {
    assert.equal(ratio(0, 30), 0);
    assert.equal(ratio(15, 30), 0.5);
    assert.equal(ratio(45, 30), 1);
    assert.equal(ratio(-5, 30), 0);
  });
  it('handles a goal of 0 and bad numbers safely', () => {
    assert.equal(ratio(0, 0), 0);
    assert.equal(ratio(5, 0), 1);
    assert.equal(ratio(5, -10), 1);
    assert.equal(ratio(Number.NaN, 30), 0);
    assert.equal(ratio(10, Number.NaN), 1);
    assert.equal(ratio(Number.POSITIVE_INFINITY, 30), 0);
  });
});

describe('stage and mood', () => {
  it('awake at 10 min or a third of the goal, whichever first', () => {
    assert.equal(awakeAt(30), 1 / 3);
    assert.equal(awakeAt(60), 10 / 60);
    assert.equal(awakeAt(15), 1 / 3);
    assert.equal(awakeAt(0), 1 / 3);
    assert.equal(awakeAt(6), 1 / 3); // a tiny goal: a third of it comes before 10 minutes
  });
  it('maps progress onto 0–2 with 1 at awake', () => {
    assert.equal(stageOf(0, 30), 0);
    assert.equal(stageOf(1 / 6, 30), 0.5);
    assert.equal(stageOf(1 / 3, 30), 1);
    assert.equal(stageOf(1, 30), 2);
    assert.equal(stageOf(5, 30), 2);
    assert.equal(stageOf(-1, 30), 0);
  });
  it('is monotonic', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const s = stageOf(p, 45);
      assert.ok(s >= last);
      last = s;
    }
  });
  it('moods follow the spec thresholds', () => {
    assert.equal(moodOf(0, 30), 'sleeping');
    assert.equal(moodOf(1, 30), 'stirring');
    assert.equal(moodOf(9, 30), 'stirring');
    assert.equal(moodOf(10, 30), 'sitting');
    assert.equal(moodOf(29, 30), 'sitting');
    assert.equal(moodOf(30, 30), 'content');
    assert.equal(moodOf(90, 30), 'content');
    assert.equal(moodOf(10, 60), 'sitting'); // 10 min comes before a third of 60
    assert.equal(moodOf(0, 0), 'sleeping');
    assert.equal(moodOf(3, 0), 'content');
  });
  it('sceneTarget bundles it all, water included', () => {
    const t = sceneTarget({ activeMinutes: 10, goalMinutes: 30, waterMl: 3000, waterGoalMl: 2000 });
    assert.deepEqual(t, { progress: 1 / 3, stage: 1, water: 1, mood: 'sitting' });
    assert.equal(sceneTarget({ activeMinutes: 0, goalMinutes: 30, waterMl: 500, waterGoalMl: 0 }).water, 1);
  });
});

describe('visuals', () => {
  it('start dim and cool with curtains about 40% open', () => {
    assert.equal(curtainsOpen(0), CURTAINS_RESTING);
    assert.equal(dimness(0), 1);
    assert.equal(lampOn(0), 0);
    assert.equal(warmth(0), 0);
    assert.equal(dustCount(0), 0);
  });
  it('are fully awake at stage 1: curtains open, lamp on, no warmth yet', () => {
    assert.equal(curtainsOpen(1), 1);
    assert.equal(lampOn(1), 1);
    assert.equal(dimness(1), 0);
    assert.equal(warmth(1), 0);
  });
  it('reach golden light and all dust at the goal, never beyond', () => {
    assert.equal(warmth(2), 1);
    assert.equal(dustCount(2), DUST_MAX);
    assert.equal(dustCount(5), DUST_MAX);
    for (let i = 0; i < DUST_MAX; i++) assert.equal(moteOpacity(i, 2), 1);
    assert.equal(moteOpacity(DUST_MAX, 2), 0);
  });
  it('move smoothly: no jumps between nearby stages', () => {
    for (let s = 0; s < 2; s += 0.01) {
      for (const f of [curtainsOpen, lampOn, dimness, warmth]) assert.ok(Math.abs(f(s + 0.01) - f(s)) < 0.03);
      assert.ok(Math.abs(dustCount(s + 0.01) - dustCount(s)) < 0.2);
    }
  });
  it('daylight: dark at night, full at midday, wraps hours', () => {
    assert.equal(daylight(0), 0);
    assert.equal(daylight(3), 0);
    assert.equal(daylight(12), 1);
    assert.equal(daylight(22), 0);
    assert.ok(daylight(7.5) > 0 && daylight(7.5) < 1);
    assert.equal(daylight(36), 1);
    assert.equal(daylight(Number.NaN), 0);
  });
});

describe('words', () => {
  it('short text and VoiceOver label', () => {
    assert.equal(minutesText(10.4, 30), '10 / 30 active min');
    assert.equal(minutesText(4, 0), '4 active min');
    assert.equal(describeScene(10, 30), 'Milo is awake. 10 of 30 active minutes.');
    assert.equal(describeScene(0, 30), 'Milo is asleep. 0 of 30 active minutes.');
    assert.equal(describeScene(1, 0), 'Milo is content. 1 active minute.');
  });
});
