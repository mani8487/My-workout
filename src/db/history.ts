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

/** A finished workout boiled down for the Home card: working sets, reps and kilos lifted. */
export type DaySummary = {
  sessionId: number;
  workoutName: string;
  startedAt: number;
  durationMin: number | null;
  workingSets: number;
  totalReps: number;
  volumeKg: number;
};

/** Finished workouts that started between two moments (milliseconds), oldest first. */
export async function getSessionSummariesBetween(db: SQLiteDatabase, from: number, to: number): Promise<DaySummary[]> {
  const rows = await db.getAllAsync<{
    id: number;
    workout_name: string;
    started_at: number;
    finished_at: number | null;
    sets: number | null;
    reps: number | null;
    volume: number | null;
  }>(
    `SELECT s.id, s.workout_name, s.started_at, s.finished_at,
            SUM(CASE WHEN st.completed_at IS NOT NULL AND st.is_warmup = 0 THEN 1 ELSE 0 END) AS sets,
            SUM(CASE WHEN st.completed_at IS NOT NULL AND st.is_warmup = 0 THEN st.reps ELSE 0 END) AS reps,
            SUM(CASE WHEN st.completed_at IS NOT NULL AND st.is_warmup = 0
                     THEN COALESCE(st.weight_kg, 0) * st.reps ELSE 0 END) AS volume
     FROM sessions s
     LEFT JOIN session_exercises se ON se.session_id = s.id
     LEFT JOIN sets st ON st.session_exercise_id = se.id
     WHERE s.status = 'finished' AND s.started_at >= ? AND s.started_at < ?
     GROUP BY s.id
     ORDER BY s.started_at`,
    from,
    to,
  );
  return rows.map((r) => ({
    sessionId: r.id,
    workoutName: r.workout_name,
    startedAt: r.started_at,
    durationMin: r.finished_at ? Math.max(1, Math.round((r.finished_at - r.started_at) / 60000)) : null,
    workingSets: r.sets ?? 0,
    totalReps: r.reps ?? 0,
    volumeKg: Math.round(r.volume ?? 0),
  }));
}

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
