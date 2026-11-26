/**
 * Milo's voice: the one status line under the Living Home room (pure, tested).
 *
 * Calm, dry, warm, a little mischievous. Never guilt, pressure, medical advice
 * or health claims. Every line is 60 characters or fewer, whatever the numbers.
 *
 * pickLine() chooses among the lines that fit today's data, and never returns
 * the line shown last time (every situation has at least two lines to pick from).
 */
import type { Mood } from './scene-state';

export const MAX_LINE_LENGTH = 60;

export type VoiceContext = {
  mood: Mood;
  activeMinutes: number;
  goalMinutes: number;
  /** Days in a row with any activity, counting today if it already has some. */
  streakDays: number;
  yesterdayMinutes: number;
  workoutDoneToday: boolean;
};

type Line = {
  id: string;
  /** Moods the line suits; leave out for any mood. */
  moods?: readonly Mood[];
  /** Extra condition on the day's data. */
  when?: (c: VoiceContext) => boolean;
  say: (c: VoiceContext) => string;
};

const n = (x: number) => Math.round(Math.max(0, Number.isFinite(x) ? x : 0));

export const LINES: readonly Line[] = [
  // ----- asleep (nothing logged yet) -----
  { id: 'sleep-ten', moods: ['sleeping'], say: () => "Still asleep. Ten minutes and I'll consider it." },
  { id: 'sleep-curtains', moods: ['sleeping'], say: () => "Curtains half open. That's my effort for today." },
  { id: 'sleep-strategy', moods: ['sleeping'], say: () => "Conserving energy. It's a whole strategy." },
  { id: 'sleep-quiet', moods: ['sleeping'], say: () => "Quiet day so far. I'm very good at those." },
  { id: 'sleep-wake', moods: ['sleeping'], say: () => 'Wake me when something moves. Ideally you.' },
  {
    id: 'sleep-yesterday-watched',
    moods: ['sleeping'],
    when: (c) => n(c.yesterdayMinutes) > 0,
    say: (c) => `${n(c.yesterdayMinutes)} minutes yesterday. I watched. Mostly from the couch.`,
  },
  {
    id: 'sleep-yesterday-nap',
    moods: ['sleeping'],
    when: (c) => n(c.yesterdayMinutes) > 0,
    say: (c) => `Yesterday: ${n(c.yesterdayMinutes)} minutes. Today: a nap, so far.`,
  },
  {
    id: 'sleep-streak',
    moods: ['sleeping'],
    when: (c) => c.streakDays >= 2,
    say: (c) => `${n(c.streakDays)} days running. I counted, between naps.`,
  },

  // ----- stirring (a little activity) -----
  { id: 'stir-ear', moods: ['stirring'], say: (c) => `${n(c.activeMinutes)} minutes in. One ear is listening.` },
  { id: 'stir-whiskers', moods: ['stirring'], say: () => "Something's happening. I can feel it in my whiskers." },
  { id: 'stir-heard', moods: ['stirring'], say: () => 'I heard that. Still deciding if I am awake.' },
  { id: 'stir-light', moods: ['stirring'], say: () => "The light's coming in. I'm not complaining. Yet." },
  { id: 'stir-stand', moods: ['stirring'], say: () => 'A bit more of that and I might actually sit up.' },

  // ----- sitting (awake) -----
  { id: 'sit-up', moods: ['sitting'], say: () => "Fine, I'm up. The view's better from here." },
  { id: 'sit-busy', moods: ['sitting'], say: () => "Lamp on, curtains open. Somebody's been busy." },
  { id: 'sit-progress', moods: ['sitting'], say: (c) => `${n(c.activeMinutes)} of ${n(c.goalMinutes)} minutes. I'm sitting up for this.` },
  { id: 'sit-supervise', moods: ['sitting'], say: () => "Awake and supervising. It's a skilled role." },
  { id: 'sit-stretch', moods: ['sitting'], say: () => "I'd stretch with you, but someone has to sit here." },
  {
    id: 'sit-workout',
    moods: ['sitting', 'content'],
    when: (c) => c.workoutDoneToday,
    say: () => "Workout done. Filed under 'things I watched'.",
  },
  {
    id: 'sit-streak',
    moods: ['sitting'],
    when: (c) => c.streakDays >= 2,
    say: (c) => `${n(c.streakDays)} days on the go. I've stopped pretending not to notice.`,
  },

  // ----- content (goal reached) -----
  { id: 'goal-credit', moods: ['content'], say: () => "Goal reached. I'm taking full credit, quietly." },
  { id: 'goal-golden', moods: ['content'], say: () => 'Golden hour, indoors. Nicely done.' },
  { id: 'goal-warm', moods: ['content'], say: (c) => `${n(c.activeMinutes)} minutes. The room's never looked this warm.` },
  { id: 'goal-glow', moods: ['content'], say: () => "Everything's glowing. I may never move again." },
  { id: 'goal-impressed', moods: ['content'], say: () => "That's the goal. Officially impressed. Don't tell." },
  {
    id: 'goal-streak',
    moods: ['content'],
    when: (c) => c.streakDays >= 3,
    say: (c) => `${n(c.streakDays)} days straight. I'm having this one framed.`,
  },

  // ----- any awake mood -----
  {
    id: 'notes',
    moods: ['stirring', 'sitting', 'content'],
    when: (c) => n(c.yesterdayMinutes) > 0,
    say: (c) => `${n(c.yesterdayMinutes)} minutes yesterday, ${n(c.activeMinutes)} today. I keep notes.`,
  },
  { id: 'water', say: () => "There's water on the sill. I'm only pointing it out." },
];

/** The lines that fit today's data. */
export function linesFor(c: VoiceContext): Line[] {
  return LINES.filter((l) => (!l.moods || l.moods.includes(c.mood)) && (!l.when || l.when(c)));
}

/**
 * Picks today's line: never the one shown last time (`lastId`). `random` is a
 * 0–1 number (Math.random() in the app, fixed in tests).
 */
export function pickLine(c: VoiceContext, lastId: string | null, random: number): { id: string; text: string } {
  const fits = linesFor(c);
  const fresh = fits.filter((l) => l.id !== lastId);
  const pool = fresh.length > 0 ? fresh : fits;
  const r = Number.isFinite(random) ? Math.min(0.999999, Math.max(0, random)) : 0;
  const line = pool[Math.floor(r * pool.length)];
  return { id: line.id, text: line.say(c) };
}
