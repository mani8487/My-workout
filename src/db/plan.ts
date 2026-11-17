/** Reading the five workouts, their planned exercises, and the library. */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Equipment, Exercise, MuscleGroup, Workout, WorkoutId } from './types';

type ExerciseRow = {
  id: string;
  name: string;
  muscles: string;
  equipment: string;
  increment_kg: number;
  is_custom: number;
};

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscles: row.muscles.split(',') as MuscleGroup[],
    equipment: row.equipment as Equipment,
    incrementKg: row.increment_kg,
    isCustom: row.is_custom === 1,
  };
}

export async function getAllExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY name');
  return rows.map(toExercise);
}

/**
 * Alternatives for a swap: exercises sharing the main muscle, ranked by how
 * many muscles they have in common. Excludes ones already in today's workout.
 */
export async function getSwapSuggestions(
  db: SQLiteDatabase,
  exerciseId: string,
  excludeIds: string[],
): Promise<{ suggested: Exercise[]; others: Exercise[] }> {
  const all = await getAllExercises(db);
  const current = all.find((e) => e.id === exerciseId);
  const pool = all.filter((e) => e.id !== exerciseId && !excludeIds.includes(e.id));
  if (!current) return { suggested: [], others: pool };

  const main = current.muscles[0];
  const score = (e: Exercise) =>
    (e.muscles[0] === main ? 10 : 0) + e.muscles.filter((m) => current.muscles.includes(m)).length;

  const suggested = pool
    .filter((e) => e.muscles.includes(main))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 6);
  const suggestedIds = new Set(suggested.map((e) => e.id));
  return { suggested, others: pool.filter((e) => !suggestedIds.has(e.id)) };
}

export async function getWorkouts(db: SQLiteDatabase): Promise<Workout[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    muscle_label: string;
    icon: string;
    sort_order: number;
  }>('SELECT * FROM workouts ORDER BY sort_order');
  return rows.map((r) => ({
    id: r.id as WorkoutId,
    name: r.name,
    muscleLabel: r.muscle_label,
    icon: r.icon,
    sortOrder: r.sort_order,
  }));
}

/** One planned exercise joined with its library details, ready to display. */
export type PlannedExercise = {
  planItemId: number;
  position: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  exercise: Exercise;
};

export async function getPlanForWorkout(db: SQLiteDatabase, workoutId: WorkoutId): Promise<PlannedExercise[]> {
  const rows = await db.getAllAsync<
    ExerciseRow & {
      plan_item_id: number;
      position: number;
      target_sets: number;
      rep_min: number;
      rep_max: number;
      rest_seconds: number;
    }
  >(
    `SELECT p.id AS plan_item_id, p.position, p.target_sets, p.rep_min, p.rep_max, p.rest_seconds,
            e.id, e.name, e.muscles, e.equipment, e.increment_kg, e.is_custom
     FROM plan_items p
     JOIN exercises e ON e.id = p.exercise_id
     WHERE p.workout_id = ?
     ORDER BY p.position`,
    workoutId,
  );
  return rows.map((r) => ({
    planItemId: r.plan_item_id,
    position: r.position,
    targetSets: r.target_sets,
    repMin: r.rep_min,
    repMax: r.rep_max,
    restSeconds: r.rest_seconds,
    exercise: toExercise(r),
  }));
}
