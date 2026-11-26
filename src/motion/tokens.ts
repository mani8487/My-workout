/**
 * Motion tokens: every duration and timing range in the app comes from here.
 *
 * Pure numbers (no React Native imports) so they can be unit-tested and used
 * inside worklets. Three bands:
 * - micro (150–250 ms): presses, blinks, ear flicks, small reactions
 * - transition (350–700 ms): state and pose changes, screens, fades
 * - ambient (3–8 s): slow idle loops (breathing, curtains, dust)
 */

export const DURATION = {
  micro: { fast: 150, base: 200, slow: 250 },
  transition: { short: 350, base: 500, long: 700 },
  ambient: { short: 3000, base: 5000, long: 8000 },
  /** One-off particle flights (confetti, sparks): long enough to fall softly. */
  particle: 1200,
} as const;

/**
 * Arcs through the air: rising slows at the top, falling speeds up, like a
 * real small animal. Heights are in Milo's 240-point stage units.
 */
export const ARC = {
  hop: { rise: 240, fall: 220, height: 28 },
  jump: { rise: 300, fall: 280, height: 58 },
} as const;

/** A random range in ms. Ambient motion picks a new value every cycle. */
export type Range = { readonly min: number; readonly max: number };

/**
 * Milo's idle timing. Each loop picks a fresh duration, pause and size every
 * cycle inside these ranges, so nothing repeats like a metronome.
 */
export const AMBIENT = {
  /** One breath in (or out). Sleeping is slower and deeper. */
  breathSleeping: { min: 2200, max: 2700 },
  breathAwake: { min: 1500, max: 1900 },
  /** Breath depth multiplier, applied per breath. */
  breathDepth: { min: 0.82, max: 1.12 },
  /** Pause between tail swishes. */
  tailGapSleeping: { min: 7000, max: 12000 },
  tailGapAwake: { min: 3500, max: 8000 },
  /** Tail swish size multiplier. */
  tailSize: { min: 0.7, max: 1.15 },
  /** Pause between ear flicks. */
  earGap: { min: 5000, max: 12000 },
  /** Pause between blinks; a fifth of blinks are doubled. */
  blinkGap: { min: 2500, max: 6500 },
  /** Pause between floating "z"s while asleep. */
  zGap: { min: 1100, max: 1700 },
  /** How long one "z" takes to float up and fade. */
  zRise: { min: 3000, max: 3600 },
  /** Pause between bursts of three laps while drinking. */
  lapGap: { min: 450, max: 1000 },
  /** Pause between celebration jumps. */
  celebrateGap: { min: 1300, max: 2000 },
} as const satisfies Record<string, Range>;

/**
 * Picks a value inside a range from a 0–1 random number. Worklet-safe, so
 * idle loops can re-roll their timing on the UI thread.
 */
export function pick(range: Range, random: number): number {
  'worklet';
  const r = Math.min(1, Math.max(0, random));
  return range.min + r * (range.max - range.min);
}
