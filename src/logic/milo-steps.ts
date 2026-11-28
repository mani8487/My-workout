/**
 * Milo Steps: the numbers behind "Milo moves like you move".
 *
 * Pure functions and constants only (no React Native), so they run in tests.
 * - Live: cadence (steps per minute) over a rolling window, and its gait.
 * - Catch-up: today's 5-minute slices, each classified by steps per minute.
 * - Replay: a 3–5 s summary of the slices since you last looked.
 * - Energy: 0–100 from steps and active minutes; it only ever rises during a day.
 * - Milestones: 5k, 8k, 10k steps.
 *
 * Scene progress (the room's light and Milo's mood) never uses steps.
 */

export type Gait = 'idle' | 'walk' | 'run';

/** Steps per minute: below `walkFrom` is idle, from `runFrom` up is a run. */
export const CADENCE = { walkFrom: 20, runFrom: 130 } as const;
/** Live cadence is measured over this rolling window. */
export const CADENCE_WINDOW_MS = 10_000;
/** Catch-up slices: today is read in pieces this long. */
export const SLICE_MIN = 5;
export const SLICE_MS = SLICE_MIN * 60_000;

/** Energy: steps and active minutes each fill part of the 0–100 bar (tune here). */
export const ENERGY = {
  /** Steps that fill the steps part completely. */
  fullSteps: 10_000,
  /** Active minutes that fill the minutes part completely. */
  fullMinutes: 30,
  /** How much of the bar each part can fill (adds up to 100). */
  stepsShare: 70,
  minutesShare: 30,
} as const;

/** Step milestones: a short celebration, and a badge on the readout. */
export const MILESTONES = [5_000, 8_000, 10_000] as const;

/** Replay: how long the summary plays, and the least new walking that earns one. */
export const REPLAY = { minMs: 3_000, maxMs: 5_000, minSteps: 200 } as const;

/** Settings keys. */
export const MILO_MOVES_KEY = 'milo_moves';
export const STEPS_SEEN_KEY = 'steps_last_seen';
export const STEPS_SLICES_KEY = 'steps_slices';
export const ENERGY_KEY = 'milo_energy';

/** The gait for a cadence in steps per minute. */
export function gaitOf(spm: number): Gait {
  if (!(spm >= CADENCE.walkFrom)) return 'idle';
  return spm >= CADENCE.runFrom ? 'run' : 'walk';
}

/**
 * Live gait bands. The live cadence wobbles by about 10 steps a minute, so a gait
 * starts at one value and only ends below a lower one: a brisk walk near 130
 * doesn't flip between trot and run every few seconds.
 */
export const LIVE_GAIT = { walkOn: CADENCE.walkFrom, walkOff: 15, runOn: 135, runOff: 125 } as const;

/** The next live gait for a new cadence reading, given the current one. */
export function nextGait(prev: Gait, spm: number): Gait {
  if (!(spm >= 0)) return 'idle';
  const G = LIVE_GAIT;
  if (spm >= (prev === 'run' ? G.runOff : G.runOn)) return 'run';
  return spm >= (prev === 'idle' ? G.walkOn : G.walkOff) ? 'walk' : 'idle';
}

/** Milo's renderer reads gaits as numbers: 0 idle, 1 trot, 2 run. */
export function gaitLevel(g: Gait): number {
  return g === 'idle' ? 0 : g === 'walk' ? 1 : 2;
}

/** A live reading: the step count since watching began, at a time. */
export type StepSample = { t: number; steps: number };

/**
 * Steps per minute over the last `CADENCE_WINDOW_MS`. `samples` are in time
 * order with a rising count. Steps before the window don't count; with no new
 * steps in the window the cadence is 0.
 */
export function cadenceOf(samples: readonly StepSample[], now: number): number {
  const from = now - CADENCE_WINDOW_MS;
  // The count at the start of the window: the last sample at or before it (or the first one inside).
  let base: StepSample | null = null;
  let last: StepSample | null = null;
  for (const s of samples) {
    if (s.t > now) break;
    if (s.t <= from) base = s;
    else if (!base) base = s;
    last = s;
  }
  if (!base || !last || last.steps <= base.steps) return 0;
  // Over the whole window when a sample before it is known; otherwise over the time actually seen.
  const span = base.t <= from ? CADENCE_WINDOW_MS : Math.max(now - base.t, 1_000);
  return ((last.steps - base.steps) / span) * 60_000;
}

/** Keeps only the samples the cadence still needs (one before the window, and everything in it). */
export function trimSamples(samples: readonly StepSample[], now: number): StepSample[] {
  const from = now - CADENCE_WINDOW_MS;
  let keepFrom = 0;
  samples.forEach((s, i) => {
    if (s.t <= from) keepFrom = i;
  });
  return samples.slice(keepFrom);
}

/** The gait of one catch-up slice holding `steps`. */
export function sliceGait(steps: number): Gait {
  return gaitOf(steps / SLICE_MIN);
}

export type DaySummary = { steps: number; walkMin: number; runMin: number };

/** Steps, minutes walked and minutes run in a list of slice step counts. */
export function summarize(slices: readonly number[]): DaySummary {
  let steps = 0;
  let walkMin = 0;
  let runMin = 0;
  for (const n of slices) {
    const s = Math.max(0, n);
    steps += s;
    const g = sliceGait(s);
    if (g === 'walk') walkMin += SLICE_MIN;
    else if (g === 'run') runMin += SLICE_MIN;
  }
  return { steps, walkMin, runMin };
}

/** Index of the slice a time falls in, counted from the start of its day. */
export function sliceIndex(t: number, dayStart: number): number {
  return Math.max(0, Math.floor((t - dayStart) / SLICE_MS));
}

/** One stretch of the replay: Milo trots or runs for `ms`. */
export type ReplayPart = { gait: Exclude<Gait, 'idle'>; ms: number };

/**
 * The replay for slices since you last looked: trot for the walking share and
 * run for the running share, in that order, squeezed into 3–5 s (more activity,
 * a longer replay). Empty when there's nothing to show.
 */
export function replayPlan(slices: readonly number[]): ReplayPart[] {
  const { walkMin, runMin } = summarize(slices);
  const total = walkMin + runMin;
  if (total === 0) return [];
  // 3 s for a short stroll, up to 5 s from about an hour of activity.
  const length = REPLAY.minMs + (REPLAY.maxMs - REPLAY.minMs) * Math.min(1, total / 60);
  // Each part gets at least a second, so a short run still reads as a run.
  const minPart = 1_000;
  if (walkMin === 0) return [{ gait: 'run', ms: Math.round(length) }];
  if (runMin === 0) return [{ gait: 'walk', ms: Math.round(length) }];
  const run = Math.max(minPart, Math.min(length - minPart, (length * runMin) / total));
  return [
    { gait: 'walk', ms: Math.round(length - run) },
    { gait: 'run', ms: Math.round(run) },
  ];
}

/** "4,230" (the readout and lines). */
export function fmtSteps(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

const mins = (m: number) => `${m} min`;

/** The line under the room after a replay, e.g. "You walked 4,200 steps. Milo trotted 15 min and ran 5 min." */
export function replayLine(steps: number, slices: readonly number[]): string {
  const { walkMin, runMin } = summarize(slices);
  const moves = [walkMin ? `trotted ${mins(walkMin)}` : null, runMin ? `ran ${mins(runMin)}` : null].filter(Boolean).join(' and ');
  return `You walked ${fmtSteps(steps)} steps.${moves ? ` Milo ${moves}.` : ''}`;
}

/** The end-of-day recap, e.g. "Milo got fitter today: 8,400 steps". */
export function recapLine(steps: number): string {
  return `Milo got fitter today: ${fmtSteps(steps)} steps`;
}

/** Energy 0–100 from today's steps and active minutes. */
export function energyOf(steps: number, activeMinutes: number): number {
  const s = Math.min(1, Math.max(0, steps) / ENERGY.fullSteps) * ENERGY.stepsShare;
  const m = Math.min(1, Math.max(0, activeMinutes) / ENERGY.fullMinutes) * ENERGY.minutesShare;
  return Math.round(Math.min(100, s + m));
}

/** The saved energy for a day: { day, value }. */
export type EnergyLog = { day: string; value: number };

/**
 * Today's energy: never lower than what was already shown today (deleting a
 * log doesn't make Milo less fit), and a fresh start on a new day.
 */
export function energyToday(computed: number, saved: string | null, day: string): number {
  let shown = 0;
  try {
    const v = JSON.parse(saved ?? 'null') as Partial<EnergyLog> | null;
    if (v && v.day === day && typeof v.value === 'number') shown = v.value;
  } catch {
    // unreadable: start from the computed value
  }
  return Math.max(shown, computed);
}

/** Milestones crossed going from `before` to `after` steps (oldest first). */
export function milestonesCrossed(before: number, after: number): number[] {
  return MILESTONES.filter((m) => before < m && after >= m);
}

/** The highest milestone reached, or null (the readout's badge). */
export function badgeOf(steps: number): number | null {
  let best: number | null = null;
  for (const m of MILESTONES) if (steps >= m) best = m;
  return best;
}

/** "5k", "10k" (the badge). */
export function badgeLabel(m: number): string {
  return `${m / 1000}k`;
}

/** What was last seen: today's steps when Home last showed them. */
export type StepsSeen = { day: string; steps: number; at: number };

export function readStepsSeen(saved: string | null, day: string): StepsSeen | null {
  try {
    const v = JSON.parse(saved ?? 'null') as Partial<StepsSeen> | null;
    if (v && v.day === day && typeof v.steps === 'number' && typeof v.at === 'number') return { day, steps: v.steps, at: v.at };
  } catch {
    // unreadable: as if nothing was seen today
  }
  return null;
}

/** Cached slices for a day: { day, slices } (the last one may still be filling up). */
export function readSlices(saved: string | null, day: string): number[] {
  try {
    const v = JSON.parse(saved ?? 'null') as { day?: string; slices?: unknown } | null;
    if (v && v.day === day && Array.isArray(v.slices) && v.slices.every((n) => typeof n === 'number')) return v.slices as number[];
  } catch {
    // unreadable: read the day again
  }
  return [];
}
