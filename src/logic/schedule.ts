/**
 * The week schedule: what happened (or is planned) on each day.
 *
 * The app has flexible days, so for FUTURE dates we project the rotation:
 *  - Today gets today's workout (the first one still to do, or your Change Workout pick).
 *  - After that, the remaining workouts of the cycle go onto the plan's
 *    training days in order, then the next cycle starts again from the top.
 *  - Training days come from how many workouts the plan has, e.g. 3 = Mon/Wed/Fri,
 *    4 = Mon/Tue/Thu/Fri, 5 = Mon–Fri. Other days are rest days.
 *  - You can move things around per date (Change Workout on a future day, or
 *    make it a rest day); those choices are saved as "overrides".
 *
 * PAST dates show what you actually logged. A past training day with nothing
 * logged counts as "missed" (only from your first-ever workout onwards).
 */
import { addDays, format, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSessionSummariesBetween, type DaySummary } from '@/db/history';
import { getSetting, setSetting } from '@/db/settings';
import type { Workout } from '@/db/types';
import { getToday } from './today';

export type DayStatus = 'completed' | 'planned' | 'rest' | 'missed';

export type ScheduleDay = {
  date: Date;
  /** "2026-11-20" */
  key: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  status: DayStatus;
  /** Workouts finished that day (usually one). */
  sessions: DaySummary[];
  /** Planned workout for today or a future day. */
  planned: Workout | null;
};

export const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const weekStartOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 }); // weeks start on Monday
export const parseDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Monday = 0 … Sunday = 6 */
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

const PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Which weekdays are training days for a plan with this many workouts. */
export function trainingWeekdays(workoutCount: number): Set<number> {
  if (workoutCount <= 0) return new Set();
  return new Set(PATTERNS[Math.min(7, workoutCount)]);
}

// ---- Per-date changes ("overrides"): a workout id, or 'rest' ----

const OVERRIDES_KEY = 'schedule_overrides';
type Overrides = Record<string, string>;

async function getOverrides(db: SQLiteDatabase): Promise<Overrides> {
  try {
    return JSON.parse((await getSetting(db, OVERRIDES_KEY)) ?? '{}') as Overrides;
  } catch {
    return {};
  }
}

/** Plan a workout on a future date, make it a rest day ('rest'), or clear the change (null). */
export async function setDayOverride(db: SQLiteDatabase, key: string, value: string | null) {
  const all = await getOverrides(db);
  const today = dateKey(new Date());
  for (const k of Object.keys(all)) if (k < today) delete all[k]; // tidy away old ones
  if (value == null) delete all[key];
  else all[key] = value;
  await setSetting(db, OVERRIDES_KEY, JSON.stringify(all));
}

/** The 7 days of the week that starts on `weekStart` (a Monday). */
export async function getWeekSchedule(db: SQLiteDatabase, weekStart: Date): Promise<ScheduleDay[]> {
  const today = startOfDay(new Date());
  const weekEnd = addDays(weekStart, 7);

  const [sessions, todaysSessions, first, { rotation, workout: todayWorkout }, overrides] = await Promise.all([
    getSessionSummariesBetween(db, weekStart.getTime(), weekEnd.getTime()),
    getSessionSummariesBetween(db, today.getTime(), addDays(today, 1).getTime()),
    db.getFirstAsync<{ first: number | null }>(`SELECT MIN(started_at) AS first FROM sessions WHERE status = 'finished'`),
    getToday(db),
    getOverrides(db),
  ]);

  const byDay = new Map<string, DaySummary[]>();
  for (const s of sessions) {
    const k = dateKey(new Date(s.startedAt));
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  const pattern = trainingWeekdays(rotation.workouts.length);
  const findWorkout = (id: string) => rotation.workouts.find((w) => w.id === id);

  // Walk forward from today, handing out workouts in rotation order.
  const planned = new Map<string, Workout>();
  if (weekEnd > today && rotation.workouts.length > 0) {
    const queue: Workout[] = [...rotation.owed];
    const take = (preferred?: Workout): Workout => {
      if (preferred) {
        const i = queue.findIndex((w) => w.id === preferred.id);
        if (i >= 0) queue.splice(i, 1);
        return preferred;
      }
      if (queue.length === 0) queue.push(...rotation.workouts); // next cycle
      return queue.shift()!;
    };

    for (let d = today; d < weekEnd; d = addDays(d, 1)) {
      const key = dateKey(d);
      if (isSameDay(d, today)) {
        // Already trained today? Then nothing more is planned for today.
        if (todaysSessions.length === 0 && todayWorkout) planned.set(key, take(todayWorkout));
        continue;
      }
      const override = overrides[key];
      if (override === 'rest') continue;
      const ov = override ? findWorkout(override) : undefined;
      if (ov) planned.set(key, take(ov));
      else if (pattern.has(weekdayIndex(d))) planned.set(key, take());
    }
  }

  const firstDay = first?.first ? startOfDay(new Date(first.first)) : null;

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = dateKey(date);
    const daySessions = byDay.get(key) ?? [];
    const isToday = isSameDay(date, today);
    const isPast = date < today;
    const plannedWorkout = planned.get(key) ?? null;
    const status: DayStatus = daySessions.length
      ? 'completed'
      : plannedWorkout
        ? 'planned'
        : isPast && firstDay && date >= firstDay && pattern.has(weekdayIndex(date))
          ? 'missed'
          : 'rest';
    return { date, key, isToday, isPast, isFuture: !isPast && !isToday, status, sessions: daySessions, planned: plannedWorkout };
  });
}
