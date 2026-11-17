/**
 * Version 1 weight suggestion: a simple, predictable rule.
 *
 *  - Hit the TOP of the rep range on every working set last time
 *    (and none was logged as "0 reps left") → add a small amount of weight.
 *  - Hit the top but logged 0 reps left on a set → repeat the weight once more.
 *  - Otherwise → keep the weight and aim for more reps.
 *
 * Later this file is where the AI-based suggestions will plug in.
 */
import type { PreviousSet } from '@/db/sessions';
import { formatKg } from './format';

export type Suggestion = {
  kind: 'first-time' | 'increase' | 'repeat' | 'stay';
  /** Weight to use today, or null if we have nothing to go on. */
  weightKg: number | null;
  /** One short line explaining why. */
  reason: string;
};

export function suggestWeight(opts: {
  previous: PreviousSet[];
  targetSets: number;
  repMin: number;
  repMax: number;
  incrementKg: number;
}): Suggestion {
  const { targetSets, repMin, repMax, incrementKg } = opts;
  const working = opts.previous.filter((s) => !s.isWarmup && s.reps != null);

  if (working.length === 0) {
    return {
      kind: 'first-time',
      weightKg: null,
      reason: `First time: pick a weight you can lift for ${repMin}–${repMax} reps.`,
    };
  }

  const topWeight = Math.max(...working.map((s) => s.weightKg ?? 0));
  const allAtTop = working.length >= targetSets && working.every((s) => (s.reps ?? 0) >= repMax);
  const anyToFailure = working.some((s) => s.rir === 0);

  if (allAtTop && !anyToFailure) {
    const next = Math.round((topWeight + incrementKg) * 100) / 100;
    return {
      kind: 'increase',
      weightKg: next,
      reason: `You hit ${repMax} reps on all ${working.length} sets last time. Go up ${formatKg(incrementKg)} kg.`,
    };
  }

  if (allAtTop && anyToFailure) {
    return {
      kind: 'repeat',
      weightKg: topWeight,
      reason: `You hit ${repMax} reps but had 0 left in the tank. Repeat ${formatKg(topWeight)} kg once more.`,
    };
  }

  return {
    kind: 'stay',
    weightKg: topWeight,
    reason: `Stay at ${formatKg(topWeight)} kg. Aim for ${repMax} reps on every set before going up.`,
  };
}
