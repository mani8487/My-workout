/**
 * Water: the daily goal and "am I on pace?". Pure functions, no imports, so
 * they can be unit-tested with plain Node (`npm test`).
 *
 * Goal = body weight (kg) × 33 ml + 500 ml per hour of exercise today,
 * rounded to the nearest 50 ml and kept between 1,500 and 5,000 ml.
 * Without a body weight we start from 2,000 ml.
 *
 * With a height too, we use a "lean-adjusted" weight: lean tissue holds most
 * of the body's water, fat much less. Above a BMI of 25, only 40% of the
 * extra weight counts (the same adjustment clinicians use for adjusted body
 * weight). At or below BMI 25 the weight is used as is.
 *
 * This is a general estimate, not medical advice (see HYDRATION_NOTE).
 */

export const ML_PER_KG = 33;
export const ML_PER_EXERCISE_HOUR = 500;
export const MIN_GOAL_ML = 1500;
export const MAX_GOAL_ML = 5000;
export const DEFAULT_BASE_ML = 2000;
/** The quick amounts on the pop-up. */
export const QUICK_ML = [250, 500] as const;
/** The day we pace against: 7:00 to 21:00. */
export const PACE_START_HOUR = 7;
export const PACE_END_HOUR = 21;
/** Within this much of the pace line counts as "on pace". */
export const PACE_SLACK_ML = 150;

export const BODY_WEIGHT_KEY = 'body_weight_kg';
export const HEIGHT_KEY = 'height_cm';
/** BMI above which extra weight only partly counts, and how much of it. */
export const LEAN_BMI = 25;
export const EXTRA_WEIGHT_SHARE = 0.4;
export const LAST_WATER_KEY = 'water_last_ml';

export const HYDRATION_NOTE =
  'This is a general estimate. If a doctor has given you a fluid target or limit, follow that.';

export const roundTo50 = (ml: number) => Math.round(ml / 50) * 50;

/** The weight the goal uses: the real weight, or lean-adjusted when height is known and BMI > 25. */
export function effectiveWeightKg(weightKg: number, heightCm?: number | null): number {
  if (heightCm == null || heightCm <= 0) return weightKg;
  const m = heightCm / 100;
  const leanTop = LEAN_BMI * m * m; // the weight at BMI 25 for this height
  return weightKg <= leanTop ? weightKg : leanTop + EXTRA_WEIGHT_SHARE * (weightKg - leanTop);
}

/** Daily goal in ml. `weightKg` null or ≤ 0 means "not set"; height is optional. */
export function waterGoalMl(weightKg: number | null | undefined, exerciseMinutes = 0, heightCm?: number | null): number {
  const base = weightKg != null && weightKg > 0 ? effectiveWeightKg(weightKg, heightCm) * ML_PER_KG : DEFAULT_BASE_ML;
  const exercise = (Math.max(0, exerciseMinutes) / 60) * ML_PER_EXERCISE_HOUR;
  return Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, roundTo50(base + exercise)));
}

export type PaceStatus = 'ahead' | 'on' | 'behind' | 'done';
export type Pace = { status: PaceStatus; expectedMl: number; line: string };

/** Share of the pacing day gone by at `now` (0 before 7:00, 1 after 21:00). */
export function dayFraction(now: Date): number {
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return Math.min(1, Math.max(0, (h - PACE_START_HOUR) / (PACE_END_HOUR - PACE_START_HOUR)));
}

/** Where you'd be on an even sip-through-the-day pace, and a short line about it. */
export function waterPace(ml: number, goal: number, now: Date): Pace {
  const expectedMl = roundTo50(goal * dayFraction(now));
  if (ml >= goal) return { status: 'done', expectedMl, line: 'Goal reached for today.' };
  const diff = ml - expectedMl;
  if (diff > PACE_SLACK_ML) return { status: 'ahead', expectedMl, line: `Ahead of pace by ${fmtMl(diff)} ml.` };
  if (diff < -PACE_SLACK_ML) return { status: 'behind', expectedMl, line: `About ${fmtMl(-diff)} ml behind pace. A glass would help.` };
  return { status: 'on', expectedMl, line: 'Right on pace.' };
}

/** 1250 → "1,250". */
export function fmtMl(ml: number): string {
  return String(Math.round(ml)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
