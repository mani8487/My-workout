/** Reading past (finished) workouts for the History tab. */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { WorkoutId } from './types';

export type HistoryItem = {
  id: number;
  workoutId: WorkoutId;
  workoutName: string;
  startedAt: number;
  finishedAt: number | null;
  workingSets: number;
};

export async function listFinishedSessions(db: SQLiteDatabase, workoutId: WorkoutId | null): Promise<HistoryItem[]> {
  const rows = await db.getAllAsync<{
    id: number;
    workout_id: string;
    workout_name: string;
    started_at: number;
    finished_at: number | null;
    working_sets: number;
  }>(
    `SELECT s.id, s.workout_id, s.workout_name, s.started_at, s.finished_at,
            (SELECT COUNT(*) FROM sets st JOIN session_exercises se ON se.id = st.session_exercise_id
              WHERE se.session_id = s.id AND st.completed_at IS NOT NULL AND st.is_warmup = 0) AS working_sets
     FROM sessions s
     WHERE s.status = 'finished' AND (? IS NULL OR s.workout_id = ?)
     ORDER BY s.started_at DESC`,
    workoutId,
    workoutId,
  );
  return rows.map((r) => ({
    id: r.id,
    workoutId: r.workout_id as WorkoutId,
    workoutName: r.workout_name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    workingSets: r.working_sets,
  }));
}
