import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeShown, encodeShown, LINES, linesFor, MAX_LINE_LENGTH, nextLine, pickLine, situationKey, type VoiceContext } from './milo-voice.ts';
import type { Mood } from './scene-state.ts';

const MOODS: Mood[] = ['sleeping', 'stirring', 'sitting', 'content'];
const base = (mood: Mood, extra: Partial<VoiceContext> = {}): VoiceContext => ({
  mood,
  activeMinutes: mood === 'sleeping' ? 0 : 12,
  goalMinutes: 30,
  streakDays: 0,
  yesterdayMinutes: 0,
  workoutDoneToday: false,
  ...extra,
});

describe('Milo voice lines', () => {
  it('has at least 20 lines with unique ids', () => {
    assert.ok(LINES.length >= 20, `only ${LINES.length}`);
    assert.equal(new Set(LINES.map((l) => l.id)).size, LINES.length);
  });

  it('every line stays within 60 characters, even with huge numbers', () => {
    for (const mood of MOODS) {
      const c = base(mood, { activeMinutes: 999, goalMinutes: 999, streakDays: 999, yesterdayMinutes: 999, workoutDoneToday: true });
      for (const l of LINES) {
        const text = l.say(c);
        assert.ok(text.length <= MAX_LINE_LENGTH, `${l.id} is ${text.length}: "${text}"`);
        assert.ok(text.trim().length > 0, l.id);
      }
    }
  });

  it('rounds and never shows negative or broken numbers', () => {
    const c = base('sitting', { activeMinutes: 12.6, goalMinutes: 30, yesterdayMinutes: Number.NaN, streakDays: -3 });
    for (const l of linesFor(c)) assert.doesNotMatch(l.say(c), /NaN|-\d|\.\d/, l.id);
    assert.ok(linesFor(c).every((l) => l.id !== 'notes')); // NaN yesterday counts as none
  });

  it('every situation has at least two lines, so there is always a fresh one', () => {
    for (const mood of MOODS) assert.ok(linesFor(base(mood)).length >= 2, mood);
  });

  it('only offers lines whose data is there', () => {
    const ids = (c: VoiceContext) => linesFor(c).map((l) => l.id);
    assert.ok(!ids(base('sleeping')).includes('sleep-yesterday-watched'));
    assert.ok(ids(base('sleeping', { yesterdayMinutes: 42 })).includes('sleep-yesterday-watched'));
    assert.ok(!ids(base('sitting')).includes('sit-streak'));
    assert.ok(ids(base('sitting', { streakDays: 2 })).includes('sit-streak'));
    assert.ok(!ids(base('content', { streakDays: 1 })).includes('goal-streak'));
    assert.ok(ids(base('content', { workoutDoneToday: true })).includes('workout-filed'));
    // Mood lines never leak into other moods.
    assert.ok(ids(base('sleeping')).every((id) => !id.startsWith('goal-') && !id.startsWith('sit-')));
  });

  it('fills in the numbers', () => {
    const c = base('sleeping', { yesterdayMinutes: 42 });
    assert.equal(LINES.find((l) => l.id === 'sleep-yesterday-watched')!.say(c), '42 minutes yesterday. I watched. Mostly from the couch.');
  });
});

describe('pickLine', () => {
  it('is deterministic for a given random number', () => {
    const c = base('sitting');
    assert.deepEqual(pickLine(c, null, 0.3), pickLine(c, null, 0.3));
  });

  it('never repeats the last line, whatever the random number', () => {
    for (const mood of MOODS) {
      const c = base(mood, { yesterdayMinutes: 20, streakDays: 4, workoutDoneToday: mood !== 'sleeping' });
      for (const l of linesFor(c)) {
        for (const r of [0, 0.25, 0.5, 0.75, 0.999999, 1]) assert.notEqual(pickLine(c, l.id, r).id, l.id);
      }
    }
  });

  it('a long run never shows the same line twice in a row', () => {
    const c = base('content', { streakDays: 5 });
    let last: string | null = null;
    let seed = 7;
    for (let i = 0; i < 500; i++) {
      seed = (seed * 16807) % 2147483647;
      const next = pickLine(c, last, seed / 2147483647).id;
      assert.notEqual(next, last);
      last = next;
    }
  });

  it('copes with odd random numbers and an unknown last id', () => {
    const c = base('stirring');
    for (const r of [-1, 2, Number.NaN]) assert.ok(linesFor(c).some((l) => l.id === pickLine(c, 'gone', r).id));
  });
});

describe('numbers read naturally', () => {
  const all = (c: VoiceContext) => linesFor(c).map((l) => l.say(c));
  it('says "1 minute", never "1 minutes" or "0 minutes"', () => {
    for (const mood of MOODS) {
      for (const c of [base(mood, { activeMinutes: mood === 'sleeping' ? 0 : 0.4, yesterdayMinutes: 1 }), base(mood, { activeMinutes: 1, yesterdayMinutes: 0.6 })]) {
        for (const text of all(c)) {
          assert.doesNotMatch(text, /\b1 minutes\b/, text);
          assert.doesNotMatch(text, /\b0 (minutes?|today|of)\b/, text);
        }
      }
    }
    const c = base('sleeping', { yesterdayMinutes: 1 });
    assert.equal(LINES.find((l) => l.id === 'sleep-yesterday-watched')!.say(c), '1 minute yesterday. I watched. Mostly from the couch.');
  });
  it('never shows a goal of 0', () => {
    assert.ok(!linesFor(base('sitting', { goalMinutes: 0 })).some((l) => l.id === 'sit-progress'));
  });
});

describe('nextLine: same situation keeps the line', () => {
  const day = '2026-11-27';
  it('keeps the shown line (with fresh numbers) while nothing important changed', () => {
    const c = base('sitting', { activeMinutes: 12 });
    const first = nextLine(c, day, null, false, 0.4);
    const again = nextLine({ ...c, activeMinutes: 18 }, day, { id: first.id, key: first.key }, false, 0.9);
    assert.equal(again.id, first.id);
  });
  it('picks a different line when the mood, the day or a fact changes, or when forced', () => {
    const c = base('sitting');
    const first = nextLine(c, day, null, false, 0.4);
    const shown = { id: first.id, key: first.key };
    assert.notEqual(nextLine(base('content'), day, shown, false, 0.4).key, first.key);
    assert.notEqual(nextLine(c, '2026-11-28', shown, false, 0.4).id, first.id);
    assert.notEqual(nextLine({ ...c, workoutDoneToday: true }, day, shown, false, 0.4).id, first.id);
    assert.notEqual(nextLine(c, day, shown, true, 0.4).id, first.id);
  });
  it('the situation ignores minutes within a mood', () => {
    assert.equal(situationKey(base('sitting', { activeMinutes: 11 }), 'd'), situationKey(base('sitting', { activeMinutes: 25 }), 'd'));
  });
  it('reads back what was saved, and old plain ids', () => {
    assert.deepEqual(decodeShown(encodeShown({ id: 'sit-up', key: 'k' })), { id: 'sit-up', key: 'k' });
    assert.deepEqual(decodeShown('sit-up'), { id: 'sit-up', key: '' });
    assert.equal(decodeShown(null), null);
    assert.equal(decodeShown('{"id":3}'), null);
  });
});
