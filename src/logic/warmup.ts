/**
 * Warm-up sets for the FIRST exercise of a workout, building up to the
 * working weight. They are tagged as warm-ups, so they never count towards
 * volume or records. Delete any you don't want with a swipe.
 */
import type { Equipment } from '@/db/types';

const roundTo = (kg: number, step: number) => Math.floor(kg / step) * step;

export function planWarmups(workingKg: number | null, equipment: Equipment): { weightKg: number; reps: number }[] {
  if (workingKg == null || workingKg < 30 || equipment === 'bodyweight' || equipment === 'dumbbell') return [];

  const steps =
    equipment === 'barbell'
      ? [
          { pct: 0, reps: 10 }, // empty bar
          { pct: 0.5, reps: 5 },
          { pct: 0.7, reps: 3 },
          { pct: 0.85, reps: 2 },
        ]
      : [
          { pct: 0.5, reps: 8 },
          { pct: 0.75, reps: 4 },
        ];

  const out: { weightKg: number; reps: number }[] = [];
  for (const s of steps) {
    const kg = s.pct === 0 ? 20 : roundTo(workingKg * s.pct, 2.5);
    const tooLight = equipment === 'barbell' ? kg < 20 : kg <= 0;
    if (tooLight || kg >= workingKg || out.some((o) => o.weightKg === kg)) continue;
    out.push({ weightKg: kg, reps: s.reps });
  }
  return out;
}

/** After a long break: about 10% lighter, rounded to the exercise's weight step. */
export function easeBack(kg: number | null, stepKg: number) {
  if (kg == null) return null;
  return Math.max(0, Math.round((kg * 0.9) / stepKg) * stepKg);
}
