/**
 * Motion: the single source of truth for how things move.
 *
 *   import { SPRING, EASE, DURATION, AMBIENT, useReducedMotion, useMotionActive } from '@/motion';
 *
 * Rules: no linear easing on UI motion; durations and springs come from here,
 * never typed into a component; loops run on the UI thread (ambient.ts) and
 * stop when the screen blurs, the app backgrounds or the component unmounts.
 */
export { breathe, floatLoop, loopWithGaps } from './ambient';
export { EASE, SPRING } from './curves';
export { MotionRoot, ReducedMotionOverride, useReducedMotion } from './reduced-motion';
export { AMBIENT, ARC, CAMEO, CELEBRATE, DURATION, LEAVE, SHAPE, STRIDE, TRIP, WAKE, WATER, cameoLength, pick, type Range } from './tokens';
export { useMotionActive } from './use-motion-active';
