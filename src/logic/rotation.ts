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

import { getWorkouts } from '@/db/plan';
import { getSetting, setSetting } from '@/db/settings';
import type { Workout, WorkoutId } from '@/db/types';

export type Rotation = {
  workouts: Workout[];
  /** Done this cycle, with the date it was done. */
  done: Map<WorkoutId, number>;
  owed: Workout[];
  /** First owed workout: today's suggestion. */
  next: Workout;
};

export async function getRotation(db: SQLiteDatabase): Promise<Rotation> {
  const workouts = await getWorkouts(db);
  let cycleStart = Number((await getSetting(db, 'cycle_start')) ?? '0');

  for (let attempt = 0; attempt < 2; attempt++) {
    const rows = await db.getAllAsync<{ workout_id: string; last: number }>(
      `SELECT workout_id, MAX(started_at) AS last FROM sessions
       WHERE status = 'finished' AND started_at >= ?
       GROUP BY workout_id`,
      cycleStart,
    );
    const done = new Map(rows.map((r) => [r.workout_id as WorkoutId, r.last]));
    const owed = workouts.filter((w) => !done.has(w.id));

    if (owed.length > 0) return { workouts, done, owed, next: owed[0] };

    // All five done: start a fresh cycle just after the latest one finished.
    cycleStart = Math.max(...rows.map((r) => r.last)) + 1;
    await setSetting(db, 'cycle_start', String(cycleStart));
  }
  return { workouts, done: new Map(), owed: workouts, next: workouts[0] };
}
