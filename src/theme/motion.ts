/**
 * Shared motion settings, so every animation in the app feels like one family.
 * Values follow Apple's guidance: springs for anything a finger moves, strong
 * ease-out curves for everything else, nothing slower than ~300 ms.
 */
import { Easing, ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/** Strong ease-out: things arriving or reacting. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Moving or morphing on screen. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** Calm settle with no bounce (state changes like a tick or a row wipe). */
export const SPRING_SETTLE = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig;
/** Settling after a drag or swipe; a hint of bounce because the finger carried momentum. */
export const SPRING_RELEASE = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig;
