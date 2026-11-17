/**
 * The rotation: which of the five workouts are still "owed" in the current cycle.
 *
 *  - A cycle starts at a saved moment ("cycle_start").
 *  - Every workout FINISHED since then counts as done.
 *  - The suggestion is the first owed workout in the usual order
 *    (Push, Pull, Legs, Shoulders & Arms, Full Body), so a skipped one stays next.
 *  - Once all five are done, a new cycle starts.
 *  - Missed weeks don't matter: owed workouts simply carry over.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { getActiveRoutineId, getRoutines, getWorkouts } from '@/db/plan';
import { getSetting, setSetting } from '@/db/settings';
import type { Routine, Workout, WorkoutId } from '@/db/types';

/** Each routine keeps its own cycle. */
export const cycleKey = (routineId: string) => `cycle_start:${routineId}`;

export type Rotation = {
  routine: Routine;
  /** The active routine's workouts, in order. */
  workouts: Workout[];
  /** Done this cycle, with the date it was done. */
  done: Map<WorkoutId, number>;
  owed: Workout[];
  /** First owed workout: today's suggestion. Null only if the routine has no workouts yet. */
  next: Workout | null;
};

export async function getRotation(db: SQLiteDatabase): Promise<Rotation> {
  const routineId = await getActiveRoutineId(db);
  const routine = (await getRoutines(db)).find((r) => r.id === routineId)!;
  const workouts = await getWorkouts(db, routineId);
  const ids = new Set(workouts.map((w) => w.id));
  // The original routine used a single "cycle_start" setting before routines existed.
  const saved = (await getSetting(db, cycleKey(routineId))) ?? (routineId === 'main' ? await getSetting(db, 'cycle_start') : null);
  let cycleStart = Number(saved ?? '0');

  if (workouts.length === 0) return { routine, workouts, done: new Map(), owed: [], next: null };

  for (let attempt = 0; attempt < 2; attempt++) {
    const rows = (
      await db.getAllAsync<{ workout_id: string; last: number }>(
        `SELECT workout_id, MAX(started_at) AS last FROM sessions
         WHERE status = 'finished' AND started_at >= ?
         GROUP BY workout_id`,
        cycleStart,
      )
    ).filter((r) => ids.has(r.workout_id));
    const done = new Map(rows.map((r) => [r.workout_id as WorkoutId, r.last]));
    const owed = workouts.filter((w) => !done.has(w.id));

    if (owed.length > 0) return { routine, workouts, done, owed, next: owed[0] };

    // All done: start a fresh cycle just after the latest one finished.
    cycleStart = Math.max(...rows.map((r) => r.last)) + 1;
    await setSetting(db, cycleKey(routineId), String(cycleStart));
  }
  return { routine, workouts, done: new Map(), owed: workouts, next: workouts[0] };
}
