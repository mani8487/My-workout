/** Saving and reading Quick Logs, plus "how active was I" totals. */
import type { SQLiteDatabase } from 'expo-sqlite';

import { activeMinutes, type ActivityGroup, type ActivityUnit, groupForMuscle } from '@/logic/activity';
import type { MuscleGroup } from './types';

export type QuickLog = {
  id: number;
  activity: string;
  name: string;
  amount: number;
  unit: ActivityUnit;
  distanceKm: number | null;
  group: ActivityGroup;
  loggedAt: number;
};

type Row = {
  id: number;
  activity: string;
  name: string;
  amount: number;
  unit: string;
  distance_km: number | null;
  muscle_group: string;
  logged_at: number;
};

const toLog = (r: Row): QuickLog => ({
  id: r.id,
  activity: r.activity,
  name: r.name,
  amount: r.amount,
  unit: r.unit as ActivityUnit,
  distanceKm: r.distance_km,
  group: r.muscle_group as ActivityGroup,
  loggedAt: r.logged_at,
});

export async function addQuickLog(db: SQLiteDatabase, log: Omit<QuickLog, 'id'>): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO quick_logs (activity, name, amount, unit, distance_km, muscle_group, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    log.activity,
    log.name,
    log.amount,
    log.unit,
    log.distanceKm,
    log.group,
    log.loggedAt,
  );
  return res.lastInsertRowId;
}

export async function deleteQuickLog(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM quick_logs WHERE id = ?', id);
}

/** Quick logs from `from` (inclusive) to `to` (exclusive), oldest first. */
export async function getQuickLogsBetween(db: SQLiteDatabase, from: number, to: number): Promise<QuickLog[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM quick_logs WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at',
    from,
    to,
  );
  return rows.map(toLog);
}

/** Active minutes in a time window: finished workouts (their length) plus quick logs. */
export async function getActiveMinutesBetween(db: SQLiteDatabase, from: number, to: number): Promise<number> {
  const w = await db.getFirstAsync<{ ms: number | null }>(
    `SELECT SUM(finished_at - started_at) AS ms FROM sessions
     WHERE status = 'finished' AND finished_at IS NOT NULL AND started_at >= ? AND started_at < ?`,
    from,
    to,
  );
  const workoutMin = (w?.ms ?? 0) / 60000;
  const logs = await getQuickLogsBetween(db, from, to);
  return workoutMin + logs.reduce((sum, l) => sum + activeMinutes(l.amount, l.unit), 0);
}

/** Groups trained since `from`, from finished workouts and quick logs (for "no legs this week"). */
export async function getGroupsTrainedSince(db: SQLiteDatabase, from: number): Promise<Set<ActivityGroup>> {
  const rows = await db.getAllAsync<{ muscles: string }>(
    `SELECT DISTINCT e.muscles FROM session_exercises se
     JOIN sessions s ON s.id = se.session_id
     JOIN exercises e ON e.id = se.exercise_id
     WHERE s.status = 'finished' AND s.started_at >= ?
       AND EXISTS (SELECT 1 FROM sets st WHERE st.session_exercise_id = se.id AND st.completed_at IS NOT NULL)`,
    from,
  );
  const groups = new Set<ActivityGroup>();
  for (const r of rows) {
    const main = r.muscles.split(',')[0] as MuscleGroup;
    if (main) groups.add(groupForMuscle(main));
  }
  const logs = await db.getAllAsync<{ muscle_group: string }>(
    'SELECT DISTINCT muscle_group FROM quick_logs WHERE logged_at >= ?',
    from,
  );
  for (const l of logs) groups.add(l.muscle_group as ActivityGroup);
  return groups;
}

/** When each bit of activity happened since `from`: finished workouts (start time) and quick logs. */
export async function getActivityTimesSince(db: SQLiteDatabase, from: number): Promise<number[]> {
  const rows = await db.getAllAsync<{ t: number }>(
    `SELECT started_at AS t FROM sessions WHERE status = 'finished' AND finished_at IS NOT NULL AND started_at >= ?
     UNION ALL
     SELECT logged_at AS t FROM quick_logs WHERE logged_at >= ?`,
    from,
    from,
  );
  return rows.map((r) => r.t);
}

/** How many workouts were finished in a time window. */
export async function countWorkoutsBetween(db: SQLiteDatabase, from: number, to: number): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sessions WHERE status = 'finished' AND finished_at IS NOT NULL AND started_at >= ? AND started_at < ?`,
    from,
    to,
  );
  return row?.n ?? 0;
}
