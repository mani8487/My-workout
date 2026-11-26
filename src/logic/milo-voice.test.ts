import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LINES, linesFor, MAX_LINE_LENGTH, pickLine, type VoiceContext } from './milo-voice.ts';
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
    assert.ok(!ids(base('content', { streakDays: 2 })).includes('goal-streak'));
    assert.ok(ids(base('content', { workoutDoneToday: true })).includes('sit-workout'));
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
