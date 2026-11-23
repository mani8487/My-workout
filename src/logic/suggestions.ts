/**
 * Suggestions for today's workout, based on what you logged recently.
 *
 * Plain rules, no AI: compare the muscle groups of your recent Quick Logs with
 * the workout's exercises. At most ONE suggestion is returned. Nothing changes
 * unless you tap Accept, and accepting changes only this session (its `apply`
 * returns a new plan for startSession; the saved plan is never touched).
 *
 * Rules, checked in this order:
 * 1. Swap: you did a fair amount (>= SWAP_MIN_MINUTES) for a group the workout
 *    also trains in the last 24 h → swap that exercise for a different one for
 *    the same muscle.
 * 2. Shorter: you've already been active >= SHORTER_AFTER_MINUTES today and
 *    the workout is long → drop the last exercises to fit what's left.
 * 3. Add legs: no legs this week (workouts or logs) and the workout has none →
 *    add one leg exercise at the end.
 */
import type { PlannedExercise } from '@/db/plan';
import type { QuickLog } from '@/db/quick-log';
import type { Exercise } from '@/db/types';
import { activeMinutes, type ActivityGroup, describeLog, groupForMuscle, GROUP_LABELS } from './activity';
import { estimateMinutes } from './today';

export const SWAP_MIN_MINUTES = 3; // e.g. 30 squats
export const SHORTER_AFTER_MINUTES = 20;
export const SHORTER_IF_WORKOUT_AT_LEAST = 35;

export type Suggestion = {
  kind: 'swap' | 'shorter' | 'add-legs';
  message: string;
  /** The plan for THIS session if you accept. */
  apply: (plan: PlannedExercise[]) => PlannedExercise[];
};

export type SuggestionInput = {
  plan: PlannedExercise[];
  /** Quick Logs from the last 24 hours. */
  recentLogs: QuickLog[];
  /** Active minutes so far today (workouts + quick logs). */
  activeTodayMin: number;
  /** Groups trained this week (workouts + quick logs). */
  groupsThisWeek: Set<ActivityGroup>;
  /** Every exercise, to pick swaps and additions from. */
  library: Exercise[];
};

const groupOf = (e: Exercise) => groupForMuscle(e.muscles[0]);

export function suggestForWorkout(input: SuggestionInput): Suggestion | null {
  const { plan, recentLogs, activeTodayMin, groupsThisWeek, library } = input;
  if (recentLogs.length === 0 || plan.length === 0) return null;
  const inPlan = new Set(plan.map((p) => p.exercise.id));

  // 1. Swap an exercise for a group you already worked.
  for (const group of ['legs', 'upper', 'core'] as const) {
    const logs = recentLogs.filter((l) => l.group === group);
    const minutes = logs.reduce((sum, l) => sum + activeMinutes(l.amount, l.unit), 0);
    if (minutes < SWAP_MIN_MINUTES) continue;
    const target = plan.find((p) => groupOf(p.exercise) === group);
    if (!target) continue;
    const alt = pickAlternative(target.exercise, library, inPlan);
    if (!alt) continue;
    const biggest = [...logs].sort((a, b) => activeMinutes(b.amount, b.unit) - activeMinutes(a.amount, a.unit))[0];
    const what =
      logs.length === 1
        ? describeLog(biggest.name, biggest.amount, biggest.unit)
        : `${Math.round(minutes)} min of ${GROUP_LABELS[group].toLowerCase()} work`;
    return {
      kind: 'swap',
      message: `You did ${what} earlier. Swap ${target.exercise.name} for ${alt.name}?`,
      apply: (p) => p.map((x) => (x.planItemId === target.planItemId ? { ...x, exercise: alt } : x)),
    };
  }

  // 2. A shorter version if you've already been active today.
  const full = estimateMinutes(plan);
  if (activeTodayMin >= SHORTER_AFTER_MINUTES && full >= SHORTER_IF_WORKOUT_AT_LEAST) {
    const budget = Math.max(20, Math.round((full - activeTodayMin) / 5) * 5);
    const kept: PlannedExercise[] = [];
    for (const p of plan) {
      if (kept.length >= 2 && estimateMinutes([...kept, p]) > budget) break;
      kept.push(p);
    }
    if (kept.length < plan.length) {
      const ids = new Set(kept.map((k) => k.planItemId));
      return {
        kind: 'shorter',
        message: `You've been active for ${Math.round(activeTodayMin)} min today. Want a shorter ${estimateMinutes(kept)}-minute version?`,
        apply: (p) => p.filter((x) => ids.has(x.planItemId)),
      };
    }
  }

  // 3. No legs this week: offer one leg exercise.
  if (!groupsThisWeek.has('legs') && !plan.some((p) => groupOf(p.exercise) === 'legs')) {
    const leg =
      library.find((e) => !inPlan.has(e.id) && groupOf(e) === 'legs' && e.equipment === 'dumbbell') ??
      library.find((e) => !inPlan.has(e.id) && groupOf(e) === 'legs');
    if (leg) {
      return {
        kind: 'add-legs',
        message: `No legs logged this week. Add ${leg.name} at the end?`,
        apply: (p) => [
          ...p,
          {
            planItemId: -1,
            position: Math.max(0, ...p.map((x) => x.position)) + 1,
            targetSets: 3,
            repMin: 10,
            repMax: 15,
            restSeconds: 90,
            exercise: leg,
          },
        ],
      };
    }
  }
  return null;
}

/** A different exercise for the same main muscle, preferring different equipment. */
function pickAlternative(current: Exercise, library: Exercise[], inPlan: Set<string>): Exercise | null {
  const main = current.muscles[0];
  const pool = library.filter((e) => e.id !== current.id && !inPlan.has(e.id) && e.muscles[0] === main);
  pool.sort(
    (a, b) =>
      Number(b.equipment !== current.equipment) - Number(a.equipment !== current.equipment) || a.name.localeCompare(b.name),
  );
  return pool[0] ?? null;
}
