/**
 * Springs and easing curves. Nothing in the UI moves linearly.
 *
 * Springs are duration-based and damped. `duration` is Reanimated's
 * perceptual duration: the move looks done by then, and the last sub-pixel
 * settle runs about 1.5x as long. Damping:
 * dampingRatio 1 = no overshoot; 0.85 = a barely-there settle (about 1%),
 * never a cartoon wobble. All of them respect the iPhone's Reduce Motion.
 */
import { Easing, ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

import { DURATION } from './tokens';

export const SPRING = {
  /** Big, calm moves: scene light, curtains, pose blends. No overshoot. */
  gentle: { duration: DURATION.transition.base, dampingRatio: 1, reduceMotion: ReduceMotion.System },
  /** Everyday settle: a value arriving, a tick, a gauge. No overshoot. */
  soft: { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System },
  /** Quick reactions: release after a drag, a paw lift, landing. Tiny settle. */
  snappy: { duration: DURATION.transition.short, dampingRatio: 0.85, reduceMotion: ReduceMotion.System },
} as const satisfies Record<string, WithSpringConfig>;

export const EASE = {
  /** Strong ease-out: things arriving or reacting. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** Moving or morphing on screen. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** Soft sine in-out: breathing and other ambient swells. */
  breathe: Easing.inOut(Easing.sin),
  /** Rising arc that slows at the top (a hop going up). */
  rise: Easing.out(Easing.quad),
  /** Falling arc that speeds up (a hop coming down). */
  fall: Easing.in(Easing.quad),
} as const;
