/**
 * Water logs, plus a tiny live store so the droplet on every screen and the
 * pop-up stay in step: call `useWaterToday()` anywhere; adding or undoing
 * refreshes them all.
 */
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getActiveMinutesBetween } from '@/db/quick-log';
import { getSetting, setSetting } from '@/db/settings';
import { dayKeyOf } from '@/logic/day';
import { useTodayKey } from '@/logic/use-today';
import { BODY_WEIGHT_KEY, effectiveWeightKg, HEIGHT_KEY, LAST_WATER_KEY, waterGoalMl } from '@/logic/hydration';

export type WaterLog = { id: number; ml: number; loggedAt: number };

function todayRange() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return [d.getTime(), d.getTime() + 86_400_000] as const;
}

export async function addWater(db: SQLiteDatabase, ml: number): Promise<number> {
  const res = await db.runAsync('INSERT INTO water_logs (ml, logged_at) VALUES (?, ?)', Math.round(ml), Date.now());
  await setSetting(db, LAST_WATER_KEY, String(Math.round(ml)));
  emit();
  return res.lastInsertRowId;
}

/** Removes the most recent glass logged today. Returns its size, or null if there was none. */
export async function undoLastWater(db: SQLiteDatabase): Promise<number | null> {
  const [from, to] = todayRange();
  const row = await db.getFirstAsync<{ id: number; ml: number }>(
    'SELECT id, ml FROM water_logs WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC, id DESC LIMIT 1',
    from,
    to,
  );
  if (!row) return null;
  await db.runAsync('DELETE FROM water_logs WHERE id = ?', row.id);
  emit();
  return row.ml;
}

export async function getWaterToday(db: SQLiteDatabase) {
  const [from, to] = todayRange();
  const [sum, weight, exercise, last, height] = await Promise.all([
    db.getFirstAsync<{ ml: number | null }>('SELECT SUM(ml) AS ml FROM water_logs WHERE logged_at >= ? AND logged_at < ?', from, to),
    getSetting(db, BODY_WEIGHT_KEY),
    getActiveMinutesBetween(db, from, to),
    getSetting(db, LAST_WATER_KEY),
    getSetting(db, HEIGHT_KEY),
  ]);
  const heightCm = Number(height) > 0 ? Number(height) : null;
  const weightKg = Number(weight) > 0 ? Number(weight) : null;
  return {
    ml: sum?.ml ?? 0,
    goal: waterGoalMl(weightKg, exercise, heightCm),
    weightKg,
    heightCm,
    /** The weight the goal actually uses (lean-adjusted when height is set). */
    goalWeightKg: weightKg ? Math.round(effectiveWeightKg(weightKg, heightCm) * 10) / 10 : null,
    exerciseMin: Math.round(exercise),
    lastMl: Number(last) > 0 ? Number(last) : 250,
    /** The local day these numbers are for. */
    day: dayKeyOf(new Date(from)),
  };
}

export type WaterToday = Awaited<ReturnType<typeof getWaterToday>>;

// ---- live store ----
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
/** Tell every water view to reload (e.g. after the body weight changes). */
export const refreshWater = emit;

export function useWaterToday() {
  const db = useSQLiteContext();
  const [data, setData] = useState<WaterToday | null>(null);
  // A new local day (midnight, or waking the app on a new day) reloads too.
  const today = useTodayKey();
  const load = useCallback(() => {
    getWaterToday(db).then(setData).catch(() => {});
  }, [db]);
  useEffect(load, [load, today]);
  useEffect(() => {
    load();
    listeners.add(load);
    // A new day, or a workout finished elsewhere: reload when the app comes back.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      listeners.delete(load);
      sub.remove();
    };
  }, [load]);
  // Also reload when the screen comes back into view (a workout or quick log may have changed the goal).
  useFocusEffect(load);
  return data;
}
