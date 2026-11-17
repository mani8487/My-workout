/**
 * Numbers for the Progress tab. Only finished workouts and working sets
 * (never warm-ups) are counted.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { MuscleGroup } from './types';

const WORKING = `st.completed_at IS NOT NULL AND st.is_warmup = 0 AND st.reps > 0`;

/** Estimated one-rep max (Epley formula). */
export function e1rm(weightKg: number, reps: number) {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

export async function getLastExerciseDone(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ exercise_id: string }>(
    `SELECT se.exercise_id FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE s.status = 'finished' AND ${WORKING}
     ORDER BY s.started_at DESC, st.completed_at DESC LIMIT 1`,
  );
  return row?.exercise_id ?? null;
}

/** Exercises you've actually logged, most recent first (for the picker). */
export async function getLoggedExercises(db: SQLiteDatabase): Promise<{ id: string; name: string }[]> {
  return db.getAllAsync<{ id: string; name: string }>(
    `SELECT se.exercise_id AS id, MAX(se.exercise_name) AS name
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE s.status = 'finished' AND ${WORKING}
     GROUP BY se.exercise_id
     ORDER BY MAX(s.started_at) DESC`,
  );
}

export type SeriesPoint = { date: number; topWeight: number; volume: number; e1rm: number };

/** One point per workout: heaviest set, total kg moved, best estimated 1RM. */
export async function getExerciseSeries(db: SQLiteDatabase, exerciseId: string, sinceMs: number): Promise<SeriesPoint[]> {
  const rows = await db.getAllAsync<{ session_id: number; started_at: number; w: number; reps: number }>(
    `SELECT s.id AS session_id, s.started_at, COALESCE(st.weight_kg, 0) AS w, st.reps
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE s.status = 'finished' AND se.exercise_id = ? AND s.started_at >= ? AND ${WORKING}
     ORDER BY s.started_at`,
    exerciseId,
    sinceMs,
  );
  const bySession = new Map<number, SeriesPoint>();
  for (const r of rows) {
    const p = bySession.get(r.session_id) ?? { date: r.started_at, topWeight: 0, volume: 0, e1rm: 0 };
    p.topWeight = Math.max(p.topWeight, r.w);
    p.volume += r.w * r.reps;
    p.e1rm = Math.max(p.e1rm, e1rm(r.w, r.reps));
    bySession.set(r.session_id, p);
  }
  return [...bySession.values()];
}

export type RecordRow = { weightKg: number; reps: number; date: number };

/**
 * Weight records: each time you lifted heavier than ever before (latest first).
 * Rep records: the most reps you've done at each weight (heaviest weights first).
 */
export async function getExerciseRecords(db: SQLiteDatabase, exerciseId: string) {
  const rows = await db.getAllAsync<{ w: number; reps: number; date: number }>(
    `SELECT COALESCE(st.weight_kg, 0) AS w, st.reps, s.started_at AS date
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE s.status = 'finished' AND se.exercise_id = ? AND ${WORKING}
     ORDER BY s.started_at, st.position`,
    exerciseId,
  );

  const weight: RecordRow[] = [];
  let best = -1;
  for (const r of rows) {
    if (r.w > best) {
      best = r.w;
      weight.push({ weightKg: r.w, reps: r.reps, date: r.date });
    } else if (r.w === best && weight.length && r.reps > weight[weight.length - 1].reps) {
      weight[weight.length - 1] = { weightKg: r.w, reps: r.reps, date: r.date };
    }
  }

  const repsByWeight = new Map<number, RecordRow>();
  for (const r of rows) {
    const cur = repsByWeight.get(r.w);
    if (!cur || r.reps > cur.reps) repsByWeight.set(r.w, { weightKg: r.w, reps: r.reps, date: r.date });
  }
  const reps = [...repsByWeight.values()].sort((a, b) => b.weightKg - a.weightKg).slice(0, 6);

  return { weight: weight.reverse().slice(0, 6), reps };
}

/**
 * Working sets per muscle in the last 7 days. The main muscle of an exercise
 * counts 1 set; each other muscle it works counts half a set.
 */
export async function getWeeklyMuscleSets(db: SQLiteDatabase): Promise<{ muscle: MuscleGroup; sets: number }[]> {
  const rows = await db.getAllAsync<{ muscles: string | null }>(
    `SELECT e.muscles FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     LEFT JOIN exercises e ON e.id = se.exercise_id
     WHERE s.status = 'finished' AND s.started_at >= ? AND ${WORKING}`,
    Date.now() - 7 * 86_400_000,
  );
  const totals = new Map<MuscleGroup, number>();
  for (const r of rows) {
    const muscles = (r.muscles ?? '').split(',').filter(Boolean) as MuscleGroup[];
    muscles.forEach((m, i) => totals.set(m, (totals.get(m) ?? 0) + (i === 0 ? 1 : 0.5)));
  }
  return [...totals.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}
