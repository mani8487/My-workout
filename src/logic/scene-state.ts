/**
 * Living Home: how today's numbers become the room (pure, unit-tested).
 *
 * The scene animates one number, the "stage" s, from 0 to 2:
 *   s = 0      no activity yet: dim, cool light, curtains ~40% open, Milo asleep
 *   0 < s < 1  waking up: curtains open, Milo stirs (breathing quickens)
 *   s = 1      awake (about 10 min, or a third of the goal if that comes first):
 *              curtains fully open, lamp on, Milo sitting
 *   s = 2      goal reached: warm golden light, every dust mote, Milo content
 * Every visual is a smooth function of s, so springing s from the old value
 * to the new one moves the whole room together. The visual functions are
 * worklets, so the UI thread computes them each frame.
 */

/** Milo is fully awake at this many minutes... */
export const AWAKE_MINUTES = 10;
/** ...or at this share of the goal, whichever comes first. */
export const AWAKE_SHARE = 1 / 3;
/** How open the curtains are before any activity. */
export const CURTAINS_RESTING = 0.4;
/** Dust motes in the light at the goal. */
export const DUST_MAX = 12;

export type Mood = 'sleeping' | 'stirring' | 'sitting' | 'content';

export type SceneInput = {
  activeMinutes: number;
  goalMinutes: number;
  waterMl: number;
  waterGoalMl: number;
};

export type SceneTarget = {
  /** Active minutes against the goal, 0–1. */
  progress: number;
  /** 0–2, see above. */
  stage: number;
  /** Water drunk against the water goal, 0–1. */
  water: number;
  mood: Mood;
};

const finite = (x: number) => (Number.isFinite(x) ? x : 0);

export function clamp01(x: number): number {
  'worklet';
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/** Smoothstep: eases in and out, flat at both ends, so nothing starts or stops abruptly. */
export function smooth(x: number): number {
  'worklet';
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/** amount / goal, clamped to 0–1. A goal of 0 (or less) counts as met once there's anything at all. */
export function ratio(amount: number, goal: number): number {
  const a = Math.max(0, finite(amount));
  const g = finite(goal);
  if (g <= 0) return a > 0 ? 1 : 0;
  return clamp01(a / g);
}

/** The progress at which Milo is fully awake. */
export function awakeAt(goalMinutes: number): number {
  const g = finite(goalMinutes);
  return g > 0 ? Math.min(AWAKE_SHARE, AWAKE_MINUTES / g) : AWAKE_SHARE;
}

/** Progress (0–1) to stage (0–2). */
export function stageOf(progress: number, goalMinutes: number): number {
  const p = clamp01(progress);
  const wake = awakeAt(goalMinutes);
  if (p <= 0) return 0;
  if (p < wake) return p / wake;
  return 1 + (p - wake) / (1 - wake);
}

/** The mood the room shows at a stage (0 asleep, below 1 stirring, below 2 awake, 2 content). */
export function moodOfStage(stage: number): Mood {
  const s = Number.isFinite(stage) ? stage : 0;
  if (s <= 0) return 'sleeping';
  if (s < 1) return 'stirring';
  if (s < 2) return 'sitting';
  return 'content';
}

export function moodOf(activeMinutes: number, goalMinutes: number): Mood {
  return moodOfStage(stageOf(ratio(activeMinutes, goalMinutes), goalMinutes));
}

export function sceneTarget(input: SceneInput): SceneTarget {
  const progress = ratio(input.activeMinutes, input.goalMinutes);
  return {
    progress,
    stage: stageOf(progress, input.goalMinutes),
    water: ratio(input.waterMl, input.waterGoalMl),
    mood: moodOf(input.activeMinutes, input.goalMinutes),
  };
}

// ---------- visuals, as functions of the stage (worklets) ----------

/** 0.4 (resting) → 1 (fully open) as Milo wakes. */
export function curtainsOpen(s: number): number {
  'worklet';
  return CURTAINS_RESTING + (1 - CURTAINS_RESTING) * smooth(s);
}

/** The lamp warms up over the second half of waking. */
export function lampOn(s: number): number {
  'worklet';
  return smooth((s - 0.5) / 0.5);
}

/** The cool dim veil over the room: heaviest at 0, gone once awake. */
export function dimness(s: number): number {
  'worklet';
  return 1 - smooth(s);
}

/** Golden light: none until awake, full at the goal. */
export function warmth(s: number): number {
  'worklet';
  return smooth(s - 1);
}

/** How many dust motes show (fractional, so each one fades in). 12 at the goal. */
export function dustCount(s: number): number {
  'worklet';
  return DUST_MAX * smooth((s - 0.4) / 1.6);
}

/** Opacity of dust mote i (0-based) at stage s. */
export function moteOpacity(i: number, s: number): number {
  'worklet';
  return clamp01(dustCount(s) - i);
}

/**
 * Daylight outside the window for a local hour (0–24, fractions allowed):
 * 0 at night, rising 6–9 am, full through the day, setting 5–8 pm.
 */
export function daylight(hour: number): number {
  const h = ((finite(hour) % 24) + 24) % 24;
  return smooth((h - 6) / 3) * (1 - smooth((h - 17) / 3));
}

// ---------- words ----------

const MOOD_WORDS: Record<Mood, string> = {
  sleeping: 'Milo is asleep',
  stirring: 'Milo is stirring',
  sitting: 'Milo is awake',
  content: 'Milo is content',
};

/** "10 / 30 active min" (the small text under the scene). */
export function minutesText(activeMinutes: number, goalMinutes: number): string {
  const m = Math.round(Math.max(0, finite(activeMinutes)));
  const g = Math.round(Math.max(0, finite(goalMinutes)));
  return g > 0 ? `${m} / ${g} active min` : `${m} active min`;
}

/** VoiceOver: "Milo is awake. 10 of 30 active minutes." */
export function describeScene(activeMinutes: number, goalMinutes: number): string {
  const m = Math.round(Math.max(0, finite(activeMinutes)));
  const g = Math.round(Math.max(0, finite(goalMinutes)));
  const amount = g > 0 ? `${m} of ${g} active minutes` : `${m} active ${m === 1 ? 'minute' : 'minutes'}`;
  return `${MOOD_WORDS[moodOf(activeMinutes, goalMinutes)]}. ${amount}.`;
}
