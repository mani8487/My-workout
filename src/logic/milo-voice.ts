/**
 * Milo's voice: the one status line under the Living Home room (pure, tested).
 *
 * Calm, dry, warm, a little mischievous. Never guilt, pressure, medical advice
 * or health claims. Every line is 60 characters or fewer, whatever the numbers.
 *
 * nextLine() keeps the current line while the situation is the same (so it
 * doesn't flicker on every visit to Home), and otherwise picks a new one among
 * the lines that fit, never the one shown last (every situation has at least
 * two lines to choose from).
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

const finite = (x: number) => (Number.isFinite(x) ? x : 0);
/** Whole minutes; anything above zero shows as at least 1 (a short session still counts). */
const n = (x: number) => {
  const v = Math.max(0, finite(x));
  return v > 0 ? Math.max(1, Math.round(v)) : 0;
};
/** "1 minute", "12 minutes". */
const minutes = (x: number) => (n(x) === 1 ? '1 minute' : `${n(x)} minutes`);
const days = (x: number) => Math.round(Math.max(0, finite(x)));

/** Streaks are mentioned from this many days on. */
const STREAK_MIN = 2;

export const LINES: readonly Line[] = [
  // ----- asleep (nothing logged yet) -----
  { id: 'sleep-room', moods: ['sleeping'], say: () => "Still asleep. I'll get up when the room does." },
  { id: 'sleep-curtains', moods: ['sleeping'], say: () => "Curtains half open. That's my effort for today." },
  { id: 'sleep-strategy', moods: ['sleeping'], say: () => "Conserving energy. It's a whole strategy." },
  { id: 'sleep-quiet', moods: ['sleeping'], say: () => "Quiet day so far. I'm very good at those." },
  { id: 'sleep-pace', moods: ['sleeping'], say: () => "Day's young. I'm pacing myself, horizontally." },
  {
    id: 'sleep-yesterday-watched',
    moods: ['sleeping'],
    when: (c) => n(c.yesterdayMinutes) > 0,
    say: (c) => `${minutes(c.yesterdayMinutes)} yesterday. I watched. Mostly from the couch.`,
  },
  {
    id: 'sleep-yesterday-dreams',
    moods: ['sleeping'],
    when: (c) => n(c.yesterdayMinutes) > 0,
    say: (c) => `Still thinking about yesterday's ${minutes(c.yesterdayMinutes)}. In my sleep.`,
  },
  {
    id: 'sleep-streak',
    moods: ['sleeping'],
    when: (c) => days(c.streakDays) >= STREAK_MIN,
    say: (c) => `${days(c.streakDays)} days running. I counted, between naps.`,
  },

  // ----- stirring (a little activity) -----
  { id: 'stir-ear', moods: ['stirring'], when: (c) => n(c.activeMinutes) > 0, say: (c) => `${minutes(c.activeMinutes)} in. One ear is listening.` },
  { id: 'stir-whiskers', moods: ['stirring'], say: () => "Something's happening. I can feel it in my whiskers." },
  { id: 'stir-heard', moods: ['stirring'], say: () => "I heard that. Still deciding if I'm awake." },
  { id: 'stir-me', moods: ['stirring'], say: () => "Something's stirring. Possibly me." },
  { id: 'stir-sit', moods: ['stirring'], say: () => 'A bit more of that and I might actually sit up.' },

  // ----- sitting (awake) -----
  { id: 'sit-up', moods: ['sitting'], say: () => "Fine, I'm up. The view's better from here." },
  { id: 'sit-busy', moods: ['sitting'], say: () => "Lamp on, curtains open. Somebody's been busy." },
  {
    id: 'sit-progress',
    moods: ['sitting'],
    when: (c) => n(c.goalMinutes) > 0,
    say: (c) => `${n(c.activeMinutes)} of ${n(c.goalMinutes)} minutes. I'm sitting up for this.`,
  },
  { id: 'sit-supervise', moods: ['sitting'], say: () => "Awake and supervising. It's a skilled role." },
  { id: 'sit-stretch', moods: ['sitting'], say: () => "I'd stretch with you, but someone has to sit here." },
  { id: 'sit-upright', moods: ['sitting'], say: () => 'Upright and alert. Mostly upright.' },
  {
    id: 'workout-filed',
    moods: ['sitting', 'content'],
    when: (c) => c.workoutDoneToday,
    say: () => "Workout done. Filed under 'things I watched'.",
  },
  {
    id: 'sit-streak',
    moods: ['sitting'],
    when: (c) => days(c.streakDays) >= STREAK_MIN,
    say: (c) => `${days(c.streakDays)} days on the go. I've stopped pretending not to notice.`,
  },

  // ----- content (goal reached) -----
  { id: 'goal-credit', moods: ['content'], say: () => "Goal reached. I'm taking full credit, quietly." },
  { id: 'goal-golden', moods: ['content'], say: () => "Everything's golden in here. Nicely done." },
  { id: 'goal-warm', moods: ['content'], say: (c) => `${minutes(c.activeMinutes)}. The room's never looked this warm.` },
  { id: 'goal-glow', moods: ['content'], say: () => "Everything's glowing. I may never move again." },
  { id: 'goal-impressed', moods: ['content'], say: () => "That's the goal. Officially impressed. Don't tell." },
  {
    id: 'goal-streak',
    moods: ['content'],
    when: (c) => days(c.streakDays) >= STREAK_MIN,
    say: (c) => `${days(c.streakDays)} days straight. I'm having this one framed.`,
  },

  // ----- any awake mood -----
  {
    id: 'notes',
    moods: ['stirring', 'sitting', 'content'],
    when: (c) => n(c.yesterdayMinutes) > 0 && n(c.activeMinutes) > 0,
    say: (c) => `${minutes(c.yesterdayMinutes)} yesterday, ${n(c.activeMinutes)} today. I keep notes.`,
  },
];

/** The lines that fit today's data. */
export function linesFor(c: VoiceContext): Line[] {
  return LINES.filter((l) => (!l.moods || l.moods.includes(c.mood)) && (!l.when || l.when(c)));
}

/**
 * Picks a line that fits: never the one shown last time (`lastId`). `random`
 * is a 0–1 number (Math.random() in the app, fixed in tests).
 */
export function pickLine(c: VoiceContext, lastId: string | null, random: number): { id: string; text: string } {
  const fits = linesFor(c);
  const fresh = fits.filter((l) => l.id !== lastId);
  const pool = fresh.length > 0 ? fresh : fits;
  const r = Number.isFinite(random) ? Math.min(0.999999, Math.max(0, random)) : 0;
  const line = pool[Math.floor(r * pool.length)];
  return { id: line.id, text: line.say(c) };
}

/**
 * What decides whether Milo says something new: the day, his mood, and the
 * facts his lines mention. Minutes changing within a mood just update the
 * numbers in the current line.
 */
export function situationKey(c: VoiceContext, day: string): string {
  return [day, c.mood, c.workoutDoneToday ? 'w' : '-', days(c.streakDays) >= STREAK_MIN ? 's' : '-', n(c.yesterdayMinutes) > 0 ? 'y' : '-'].join('|');
}

/** The line shown last, saved between visits. */
export type ShownLine = { id: string; key: string };

export function encodeShown(v: ShownLine): string {
  return JSON.stringify(v);
}

export function decodeShown(saved: string | null): ShownLine | null {
  if (!saved) return null;
  try {
    const v = JSON.parse(saved) as Partial<ShownLine>;
    return typeof v.id === 'string' && typeof v.key === 'string' ? { id: v.id, key: v.key } : null;
  } catch {
    return { id: saved, key: '' }; // an older plain id: still never repeat it
  }
}

/**
 * The line for this visit: the same one (with fresh numbers) while the
 * situation hasn't changed, otherwise a new one that isn't the last one.
 * `fresh` forces a new line (coming back to the app).
 */
export function nextLine(c: VoiceContext, day: string, shown: ShownLine | null, fresh: boolean, random: number): { id: string; text: string; key: string } {
  const key = situationKey(c, day);
  const same = shown && !fresh && shown.key === key ? linesFor(c).find((l) => l.id === shown.id) : undefined;
  if (same) return { id: same.id, text: same.say(c), key };
  return { ...pickLine(c, shown?.id ?? null, random), key };
}
