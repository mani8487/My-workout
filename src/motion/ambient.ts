/**
 * Ambient loops that never look mechanical. Each one runs entirely on the UI
 * thread: when a cycle finishes, its animation callback rolls new random
 * timing (and size) and starts the next cycle. No JS timers, no React state.
 *
 * Loops are named function declarations because worklets can only call
 * themselves recursively that way.
 *
 * Only start a loop when motion is allowed (useReducedMotion() is false).
 * Every step says ReduceMotion.Never, so a loop can never collapse into zero
 * time and reschedule itself in a tight recursion.
 *
 * Stopping: cancelAnimation(value), or assigning a new animation to it. The
 * running cycle then finishes with finished = false and nothing reschedules.
 */
import { ReduceMotion, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { EASE } from './curves';
import { DURATION, pick, type Range } from './tokens';

type Animation = number; // Reanimated types animation objects as the value they animate

const NEVER = ReduceMotion.Never;

/**
 * Plays `play()` over and over with a random pause (from `gap`) before each
 * run. `play` must end at `rest`; it is called fresh every cycle, so it can
 * roll its own random size. Each cycle first eases back to `rest`, so a loop
 * restarted after a pause never hangs at a half-finished angle.
 */
export function loopWithGaps(value: SharedValue<number>, rest: number, gap: Range, play: () => Animation) {
  'worklet';
  function cycle() {
    'worklet';
    value.set(
      withSequence(
        NEVER,
        withTiming(rest, { duration: DURATION.transition.short, easing: EASE.inOut, reduceMotion: NEVER }),
        withDelay(pick(gap, Math.random()), play(), NEVER),
        // A no-op hold at rest whose callback starts the next cycle.
        withTiming(rest, { duration: DURATION.micro.fast, easing: EASE.out, reduceMotion: NEVER }, (finished) => {
          if (finished) cycle();
        }),
      ),
    );
  }
  cycle();
}

/**
 * Breathing: 0 → 1 → 0 with every breath a slightly different length and
 * depth. Read `value * depth` for the swell. The out-breath is a touch longer
 * than the in-breath, as in real breathing.
 */
export function breathe(value: SharedValue<number>, depth: SharedValue<number>, period: Range, depthRange: Range) {
  'worklet';
  function cycle() {
    'worklet';
    const inhale = pick(period, Math.random());
    depth.set(pick(depthRange, Math.random())); // breath is at 0 here, so the change is invisible
    value.set(
      withSequence(
        NEVER,
        withTiming(1, { duration: inhale, easing: EASE.breathe, reduceMotion: NEVER }),
        withTiming(0, { duration: inhale * 1.15, easing: EASE.breathe, reduceMotion: NEVER }, (finished) => {
          if (finished) cycle();
        }),
      ),
    );
  }
  if (value.get() > 0.01) {
    // Resuming mid-breath: finish breathing out first.
    value.set(
      withTiming(0, { duration: DURATION.transition.base, easing: EASE.breathe, reduceMotion: NEVER }, (finished) => {
        if (finished) cycle();
      }),
    );
  } else cycle();
}

/**
 * A rising particle (like a sleepy "z"): 0 → 1 with a gentle ease-out, then
 * back to 0 (invisible there) and a random gap. Read the value as progress
 * along the float path; fade it in and out with sin(pi * t). Resuming
 * mid-flight finishes the current float before starting the next.
 */
export function floatLoop(value: SharedValue<number>, firstDelay: number, gap: Range, rise: Range) {
  'worklet';
  function cycle(wait: number) {
    'worklet';
    value.set(0);
    value.set(
      withDelay(
        wait,
        withTiming(1, { duration: pick(rise, Math.random()), easing: EASE.rise, reduceMotion: NEVER }, (finished) => {
          if (finished) cycle(pick(gap, Math.random()));
        }),
        NEVER,
      ),
    );
  }
  const t = value.get();
  if (t > 0 && t < 1) {
    value.set(
      withTiming(1, { duration: (1 - t) * rise.max, easing: EASE.rise, reduceMotion: NEVER }, (finished) => {
        if (finished) cycle(pick(gap, Math.random()));
      }),
    );
  } else cycle(firstDelay);
}
