/**
 * "Today's workout" on Home: the rotation's suggestion, unless you picked a
 * different one with Change Workout. Your pick is cleared when a workout is
 * finished, so the rotation takes over again.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { getActiveRoutineId, getPlanForWorkout, getRoutines, getWorkouts, type PlannedExercise } from '@/db/plan';
import { getSetting, setSetting } from '@/db/settings';
import type { Workout, WorkoutId } from '@/db/types';
import { getRotation, type Rotation } from './rotation';

export async function chooseWorkout(db: SQLiteDatabase, id: WorkoutId | null) {
  await setSetting(db, 'selected_workout', id);
}

/** workout is null only when the active routine has no workouts yet. */
export async function getToday(db: SQLiteDatabase): Promise<{ rotation: Rotation; workout: Workout | null }> {
  const rotation = await getRotation(db);
  const picked = (await getSetting(db, 'selected_workout')) as WorkoutId | null;
  const workout = rotation.workouts.find((w) => w.id === picked) ?? rotation.next;
  return { rotation, workout };
}

/** Rough minutes: each set takes its rest time plus about 45 s of lifting. Rounded to 5. */
export function estimateMinutes(plan: PlannedExercise[]) {
  const seconds = plan.reduce((sum, p) => sum + p.targetSets * (p.restSeconds + 45), 0);
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

export async function getWorkoutPreview(db: SQLiteDatabase, id: WorkoutId) {
  const plan = await getPlanForWorkout(db, id);
  return { plan, minutes: estimateMinutes(plan) };
}

/** Mon–Sun of this week, marking days you finished a workout. */
export async function getWeekStrip(db: SQLiteDatabase) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = monday.getTime() + 7 * 86_400_000;

  const rows = await db.getAllAsync<{ started_at: number }>(
    `SELECT started_at FROM sessions WHERE status = 'finished' AND started_at >= ? AND started_at < ?`,
    monday.getTime(),
    nextMonday,
  );
  const trained = new Set(rows.map((r) => new Date(r.started_at).toDateString()));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86_400_000);
    return {
      key: d.toDateString(),
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: d.getDate(),
      isToday: d.toDateString() === now.toDateString(),
      trained: trained.has(d.toDateString()),
    };
  });
}

/** One card per routine for the "Your plans" scroller. */
export async function getRoutineCards(db: SQLiteDatabase) {
  const [routines, activeId] = await Promise.all([getRoutines(db), getActiveRoutineId(db)]);
  return Promise.all(
    routines.map(async (r) => {
      const workouts = await getWorkouts(db, r.id);
      const mins = await Promise.all(workouts.map(async (w) => (await getWorkoutPreview(db, w.id)).minutes));
      const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 5) * 5 : 0;
      return { routine: r, days: workouts.length, minutes: avg, active: r.id === activeId };
    }),
  );
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
