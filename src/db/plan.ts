/** Reading the five workouts, their planned exercises, and the library. */
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from './settings';
import type { Equipment, Exercise, MuscleGroup, Routine, Workout, WorkoutId } from './types';

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

/** All workouts (every routine), or just one routine's when routineId is given. */
export async function getWorkouts(db: SQLiteDatabase, routineId?: string): Promise<Workout[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    muscle_label: string;
    icon: string;
    sort_order: number;
    routine_id: string;
  }>(
    `SELECT w.* FROM workouts w JOIN routines r ON r.id = w.routine_id
     WHERE (? IS NULL OR w.routine_id = ?) ORDER BY r.sort_order, w.sort_order`,
    routineId ?? null,
    routineId ?? null,
  );
  return rows.map((r) => ({
    id: r.id as WorkoutId,
    name: r.name,
    muscleLabel: r.muscle_label,
    icon: r.icon,
    sortOrder: r.sort_order,
    routineId: r.routine_id,
  }));
}

// ---------- Routines ----------

export async function getRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; sort_order: number }>(
    'SELECT * FROM routines ORDER BY sort_order',
  );
  return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
}

export async function getActiveRoutineId(db: SQLiteDatabase): Promise<string> {
  const id = await getSetting(db, 'active_routine');
  if (id && (await db.getFirstAsync('SELECT 1 FROM routines WHERE id = ?', id))) return id;
  // Not set (or deleted): fall back to the first routine.
  const first = await db.getFirstAsync<{ id: string }>('SELECT id FROM routines ORDER BY sort_order LIMIT 1');
  return first?.id ?? 'main';
}

/**
 * Switch plans. Switching starts a fresh cycle in the new plan (history is kept),
 * and any Change Workout pick belonged to the old plan, so it's cleared.
 */
export async function setActiveRoutine(db: SQLiteDatabase, id: string) {
  await setSetting(db, 'active_routine', id);
  await setSetting(db, 'selected_workout', null);
  await setSetting(db, `cycle_start:${id}`, String(Date.now())); // same key as rotation.ts cycleKey()
  await setSetting(db, 'schedule_overrides', null); // day-by-day changes belonged to the old plan
}

export async function addRoutine(db: SQLiteDatabase, name: string): Promise<string> {
  const base = 'routine-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = base;
  for (let n = 2; await db.getFirstAsync('SELECT 1 FROM routines WHERE id = ?', id); n++) id = `${base}-${n}`;
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM routines');
  await db.runAsync('INSERT INTO routines (id, name, sort_order) VALUES (?, ?, ?)', id, name.trim(), (max?.m ?? 0) + 1);
  return id;
}

export async function renameRoutine(db: SQLiteDatabase, id: string, name: string) {
  await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', name.trim(), id);
}

/**
 * Deletes a routine with its workouts and plans. History is kept.
 * Returns false if it's your only routine (the app always needs one).
 */
export async function deleteRoutine(db: SQLiteDatabase, id: string): Promise<boolean> {
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM routines');
  if ((count?.n ?? 0) <= 1) return false;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM plan_items WHERE workout_id IN (SELECT id FROM workouts WHERE routine_id = ?)', id);
    await txn.runAsync('DELETE FROM workouts WHERE routine_id = ?', id);
    await txn.runAsync('DELETE FROM routines WHERE id = ?', id);
  });
  // If it was active, switch to whichever routine is first now.
  if ((await getSetting(db, 'active_routine')) === id || id === 'main') {
    await setActiveRoutine(db, await getActiveRoutineId(db));
  }
  return true;
}

// ---------- Plan editing (changes apply to future workouts only) ----------

export async function updatePlanItem(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<{ targetSets: number; repMin: number; repMax: number; restSeconds: number }>,
) {
  const cols = { targetSets: 'target_sets', repMin: 'rep_min', repMax: 'rep_max', restSeconds: 'rest_seconds' } as const;
  const keys = Object.keys(patch) as (keyof typeof cols)[];
  if (!keys.length) return;
  await db.runAsync(
    `UPDATE plan_items SET ${keys.map((k) => `${cols[k]} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map((k) => patch[k]!),
    id,
  );
}

/** Renumbers positions 1, 2, 3… in the given order. */
async function renumber(db: SQLiteDatabase, ids: number[]) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let i = 0; i < ids.length; i++) await txn.runAsync('UPDATE plan_items SET position = ? WHERE id = ?', i + 1, ids[i]);
  });
}

async function planIds(db: SQLiteDatabase, workoutId: WorkoutId) {
  const rows = await db.getAllAsync<{ id: number }>('SELECT id FROM plan_items WHERE workout_id = ? ORDER BY position, id', workoutId);
  return rows.map((r) => r.id);
}

export async function movePlanItem(db: SQLiteDatabase, workoutId: WorkoutId, id: number, direction: -1 | 1) {
  const ids = await planIds(db, workoutId);
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await renumber(db, ids);
}

/** Saves a new order for a workout's exercises (plan item ids, first to last). */
export async function reorderPlanItems(db: SQLiteDatabase, ids: number[]) {
  await renumber(db, ids);
}

export async function removePlanItem(db: SQLiteDatabase, workoutId: WorkoutId, id: number) {
  await db.runAsync('DELETE FROM plan_items WHERE id = ?', id);
  await renumber(db, await planIds(db, workoutId));
}

export async function addPlanItem(db: SQLiteDatabase, workoutId: WorkoutId, exerciseId: string) {
  const ids = await planIds(db, workoutId);
  await db.runAsync(
    `INSERT INTO plan_items (workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
     VALUES (?, ?, ?, 3, 8, 12, 120)`,
    workoutId,
    exerciseId,
    ids.length + 1,
  );
}

// ---------- Your own workouts (beyond the original five) ----------

export const isCustomWorkout = (id: WorkoutId) => id.startsWith('custom-');

/** Adds a new workout at the end of a routine's rotation. Returns its id. */
export async function addWorkout(
  db: SQLiteDatabase,
  w: { name: string; muscleLabel: string; icon: string; routineId: string },
) {
  const base = 'custom-' + w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = base;
  for (let n = 2; await db.getFirstAsync('SELECT 1 FROM workouts WHERE id = ?', id); n++) id = `${base}-${n}`;
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM workouts WHERE routine_id = ?',
    w.routineId,
  );
  await db.runAsync(
    'INSERT INTO workouts (id, name, muscle_label, icon, sort_order, routine_id) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    w.name.trim(),
    w.muscleLabel.trim() || 'Custom workout',
    w.icon,
    (max?.m ?? 0) + 1,
    w.routineId,
  );
  return id;
}

/** Removes one of YOUR workouts and its plan. Past sessions stay in History. */
export async function deleteWorkout(db: SQLiteDatabase, id: WorkoutId) {
  if (!isCustomWorkout(id)) return;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM plan_items WHERE workout_id = ?', id);
    await txn.runAsync('DELETE FROM workouts WHERE id = ?', id);
    await txn.runAsync(`DELETE FROM settings WHERE key = 'selected_workout' AND value = ?`, id);
  });
}

// ---------- Custom exercises ----------

export async function addCustomExercise(
  db: SQLiteDatabase,
  e: { name: string; muscles: MuscleGroup[]; equipment: Equipment },
): Promise<string> {
  const base = 'custom-' + e.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = base;
  for (let n = 2; await db.getFirstAsync('SELECT 1 FROM exercises WHERE id = ?', id); n++) id = `${base}-${n}`;
  await db.runAsync(
    'INSERT INTO exercises (id, name, muscles, equipment, increment_kg, is_custom) VALUES (?, ?, ?, ?, ?, 1)',
    id,
    e.name.trim(),
    e.muscles.join(','),
    e.equipment,
    e.equipment === 'dumbbell' ? 2 : 2.5,
  );
  return id;
}

/** Returns false if the exercise is still in your plan (remove it there first). */
export async function deleteCustomExercise(db: SQLiteDatabase, id: string): Promise<boolean> {
  const used = await db.getFirstAsync('SELECT 1 FROM plan_items WHERE exercise_id = ?', id);
  if (used) return false;
  await db.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', id);
  return true;
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
