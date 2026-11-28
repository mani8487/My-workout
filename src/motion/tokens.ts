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
  /** Hopping off the couch toward you (Start), landing on the floor in front. `near` is how much
   *  bigger he ends up, standing closer to you (he scales from his feet). */
  leap: { rise: 180, fall: 160, height: 34, near: 1.12 },
} as const;

/** Squash and stretch shapes (scaleX, scaleY), volume roughly kept. */
export const SHAPE = {
  stretchLong: { x: 1.1, y: 0.92 }, // waking stretch, long and low
  crouch: { x: 1.06, y: 0.9 }, // anticipation before leaving the ground
  takeoff: { x: 0.96, y: 1.06 }, // stretched upward in the air
  land: { x: 1.08, y: 0.9 }, // squash on landing
} as const;

const { micro, transition } = DURATION;

/** Milo waking up, in ms from the start: eyes, stretch, crouch, hop, land. */
export const WAKE = {
  eyesOpen: micro.slow,
  stretch: micro.slow + micro.base,
  crouch: micro.slow + micro.base + transition.short,
  hop: micro.slow + micro.base + transition.short + micro.base,
  land: micro.slow + micro.base + transition.short + micro.base + ARC.hop.rise + ARC.hop.fall,
} as const;

/** Leaving for a workout, in ms from the tap: ears perk, crouch, take off. Total about 650 ms. */
export const LEAVE = {
  perk: 0,
  crouch: 100, // overlaps the perk: anticipation
  takeoff: 250,
} as const;

/** The room (and Milo) on the way out to a workout and back, in ms. */
export const TRIP = {
  /** The room starts easing up and out as Milo comes down to land... */
  roomOut: 450,
  /** ...the workout screen is opened just before he lands (his squash shows through its fade)... */
  navigate: 500,
  /** ...and fades in, finishing the whole start at about 800 ms. */
  screenFade: 300,
  /** Coming back: a beat after Home is in view, Milo hops back in. */
  arrive: 250,
} as const;

/**
 * Activity cameos (after a Quick Log), each 1.5–2.5 s with its settle:
 * a stretch (reach, hold, release), a walk (steps), a run (strides), squats (down, up).
 */
export const CAMEO = {
  /** The little wind-up before each one (anticipation). */
  windUp: 150,
  stretch: { reach: 550, hold: 600, release: 600 },
  walk: { step: 400, steps: 4 },
  run: { stride: 260, strides: 6 },
  squat: { down: 340, up: 300, reps: 3 },
  /** A short pause between queued cameos, and after a log lands before the first. */
  gap: 300,
  /** With Reduce Motion: how long the still cameo pose shows. */
  still: 1500,
} as const;

/** How long each cameo's motion lasts (before its final small settle). */
export function cameoLength(kind: 'stretch' | 'walk' | 'run' | 'squat'): number {
  switch (kind) {
    case 'stretch':
      return CAMEO.windUp + CAMEO.stretch.reach + CAMEO.stretch.hold + CAMEO.stretch.release;
    case 'walk':
      return CAMEO.windUp + CAMEO.walk.step * CAMEO.walk.steps;
    case 'run':
      return CAMEO.windUp + CAMEO.run.stride * CAMEO.run.strides;
    case 'squat':
      return CAMEO.windUp + (CAMEO.squat.down + CAMEO.squat.up) * CAMEO.squat.reps;
  }
}

/** One celebration jump, in ms from its start: crouch, take off, land. */
export const CELEBRATE = {
  crouch: micro.fast,
  takeoff: micro.base,
  land: micro.fast + ARC.jump.rise + ARC.jump.fall,
} as const;

/**
 * Water on Milo (Home), in ms from the moment a drink lands: the pour stream,
 * the level rising, the slosh dying down, bubbles, and Milo's reaction
 * (ears, a happy blink, a tail flick, a quick lap and lick), staggered.
 */
export const WATER = {
  /** The stream falls from above him into the water (and its tail follows it in). */
  pour: 550,
  /** The stream reaches the surface (about 40% into the pour): the level starts rising and the surface starts to slosh. */
  pourLand: 220,
  /** The slosh dies away over this long. */
  slosh: 1500,
  /** Bubbles drift up through the water. */
  bubbles: 1400,
  /** The shimmer that sweeps across him when the goal is reached... */
  shimmer: 900,
  /** ...and then his happy paw lift. */
  goalPose: 700,
  /** Reaction beats (awake only): ears perk as the water rises, a happy blink, the tail, the lap. */
  ears: micro.fast + 60,
  blink: micro.slow,
  blinkHold: transition.short,
  tail: 400,
  lap: 750,
  /** Glancing at his bowl (behind pace): how long he looks, and the wait after Home appears. */
  glanceHold: 1400,
  glanceAfter: 4000,
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
  /** Still lying down, but the first activity of the day has him stirring: a little quicker. */
  breathStirring: { min: 1800, max: 2200 },
  /** Content at the goal: slow, easy breaths. */
  breathContent: { min: 2000, max: 2500 },
  /** Breath depth multiplier, applied per breath. */
  breathDepth: { min: 0.82, max: 1.12 },
  /** Pause between tail swishes. */
  tailGapSleeping: { min: 7000, max: 12000 },
  tailGapAwake: { min: 3500, max: 8000 },
  /** Tail swish size multiplier. */
  tailSize: { min: 0.7, max: 1.15 },
  /** Pause between ear flicks. */
  earGap: { min: 5000, max: 12000 },
  /** Stirring: the ears flick more often. */
  earGapStirring: { min: 2500, max: 6000 },
  /** Content: a slow "cat blink" (eyes open a little, then close again). */
  contentBlinkGap: { min: 3500, max: 7000 },
  tailGapContent: { min: 5000, max: 9000 },
  /** Pause between blinks; a fifth of blinks are doubled. */
  blinkGap: { min: 2500, max: 6500 },
  /** Pause between floating "z"s while asleep. */
  zGap: { min: 1100, max: 1700 },
  /** How long one "z" takes to float up and fade. */
  zRise: { min: 3000, max: 3600 },
  /** Pause between bursts of three laps while drinking. */
  lapGap: { min: 450, max: 1000 },
  /** Living Home: curtain hems sway in a draught now and then. */
  curtainGap: { min: 3000, max: 7000 },
  /** Living Home: one swing of a curtain hem or the plant's leaves. */
  swayTime: { min: 550, max: 700 },
  /** Living Home: the plant's leaves stir. */
  plantGap: { min: 3500, max: 8000 },
  /** Living Home: the lamp glow swells and eases (one half-cycle), then rests. */
  glowSwell: { min: 2500, max: 4000 },
  glowGap: { min: 300, max: 1500 },
  /** Living Home: one dust mote drifting through the light, then a pause. */
  dustDrift: { min: 5000, max: 8000 },
  dustGap: { min: 200, max: 1800 },
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
