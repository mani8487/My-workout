/**
 * Ambient loops that never look mechanical. Each one runs entirely on the UI
 * thread: when a cycle finishes, its animation callback rolls new random
 * timing (and size) and starts the next cycle. No JS timers, no React state.
 *
 * Loops are named function declarations because worklets can only call
 * themselves recursively that way.
 *
 * Stopping: cancelAnimation(value), or assigning a new animation to it. The
 * running cycle then finishes with finished = false and nothing reschedules.
 */
import { withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { EASE } from './curves';
import { DURATION, pick, type Range } from './tokens';

type Animation = number; // Reanimated types animation objects as the value they animate

/**
 * Plays `play()` over and over with a random pause (from `gap`) before each
 * run. `play` must end at `rest`; it is called fresh every cycle, so it can
 * roll its own random size. Every run, the first included, starts after a pause.
 */
export function loopWithGaps(value: SharedValue<number>, rest: number, gap: Range, play: () => Animation) {
  'worklet';
  function cycle() {
    'worklet';
    value.set(
      withSequence(
        withDelay(pick(gap, Math.random()), play()),
        // A no-op hold at rest whose callback starts the next cycle.
        withTiming(rest, { duration: DURATION.micro.fast, easing: EASE.out }, (finished) => {
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
        withTiming(1, { duration: inhale, easing: EASE.breathe }),
        withTiming(0, { duration: inhale * 1.15, easing: EASE.breathe }, (finished) => {
          if (finished) cycle();
        }),
      ),
    );
  }
  if (value.get() > 0.01) {
    // Resuming mid-breath: finish breathing out first.
    value.set(
      withTiming(0, { duration: DURATION.transition.base, easing: EASE.breathe }, (finished) => {
        if (finished) cycle();
      }),
    );
  } else cycle();
}

/**
 * A rising particle (like a sleepy "z"): 0 → 1 with a gentle ease-out, then
 * jumps back to 0 (invisible there) and waits a random gap. Read the value as
 * progress along the float path; fade it in and out with sin(pi * t).
 */
export function floatLoop(value: SharedValue<number>, firstDelay: number, gap: Range, rise: Range) {
  'worklet';
  function cycle(wait: number) {
    'worklet';
    value.set(0);
    value.set(
      withDelay(
        wait,
        withTiming(1, { duration: pick(rise, Math.random()), easing: EASE.rise }, (finished) => {
          if (finished) cycle(pick(gap, Math.random()));
        }),
      ),
    );
  }
  cycle(firstDelay);
}
