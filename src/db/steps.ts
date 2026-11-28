/**
 * Today's steps for Milo Steps: one small live store, so Home's room, its
 * readout and the steps sheet always agree. `useStepsToday()` loads (and
 * reloads on focus, on coming back from the background and on a new day);
 * `useLiveSteps(on)` adds live steps and gives the cadence while Home is in view.
 *
 * With the "Milo moves with me" setting off, nothing here touches the sensor.
 */
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getActiveMinutesBetween } from '@/db/quick-log';
import { getSetting, setSetting } from '@/db/settings';
import { dayKeyOf } from '@/logic/day';
import {
  ENERGY_KEY,
  MILO_MOVES_KEY,
  SLICE_MS,
  STEPS_SLICES_KEY,
  cadenceOf,
  energyOf,
  energyToday,
  gaitLevel,
  nextGait,
  readSlices,
  sliceIndex,
  trimSamples,
  type Gait,
  type StepSample,
} from '@/logic/milo-steps';
import { useTodayKey } from '@/logic/use-today';
import { stepSource } from '@/sensors/step-source';

export type StepsStatus = 'off' | 'unavailable' | 'denied' | 'ok';

export type StepsToday = {
  /** Settings → "Milo moves with me". */
  enabled: boolean;
  status: StepsStatus;
  steps: number;
  /** Steps in each 5-minute slice since midnight (the last one may still be filling). */
  slices: number[];
  /** Active minutes today (workouts and quick logs): part of the energy. */
  activeMinutes: number;
  /** 0–100; never lower than earlier today. */
  energy: number;
  /** The local day these numbers are for. */
  day: string;
  /** When this was read from the sensor (live steps added later keep it). */
  loadedAt: number;
};

/** How many slice queries run at once while catching up on a day. */
const BATCH = 12;

function dayStartOf(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const empty = (enabled: boolean, status: StepsStatus, day: string, activeMinutes = 0): StepsToday => ({
  enabled,
  status,
  steps: 0,
  slices: [],
  activeMinutes,
  energy: 0,
  day,
  loadedAt: Date.now(),
});

/** Reads today: the total, the 5-minute slices (only the ones not cached yet), and the energy. */
async function loadSteps(db: SQLiteDatabase): Promise<StepsToday> {
  const now = new Date();
  const from = dayStartOf(now);
  const day = dayKeyOf(new Date(from));
  if ((await getSetting(db, MILO_MOVES_KEY)) === '0') return empty(false, 'off', day);
  const activeMinutes = await getActiveMinutesBetween(db, from, from + 86_400_000);
  if (!(await stepSource.isAvailable())) return empty(true, 'unavailable', day, activeMinutes);
  let perm = await stepSource.permission().catch(() => 'denied' as const);
  if (perm === 'undetermined') perm = await stepSource.requestPermission().catch(() => 'denied' as const);
  if (perm !== 'granted') return empty(true, 'denied', day, activeMinutes);

  // Slices: keep the cached ones, re-read the last (it was still filling), read the rest.
  const cached = readSlices(await getSetting(db, STEPS_SLICES_KEY), day);
  const last = sliceIndex(now.getTime(), from);
  const slices = cached.slice(0, Math.max(0, Math.min(cached.length - 1, last)));
  for (let i = slices.length; i <= last; i += BATCH) {
    const batch = [];
    for (let j = i; j <= Math.min(last, i + BATCH - 1); j++) {
      const start = from + j * SLICE_MS;
      batch.push(stepSource.stepsBetween(new Date(start), new Date(Math.min(now.getTime(), start + SLICE_MS))).catch(() => 0));
    }
    slices.push(...(await Promise.all(batch)));
  }
  const steps = await stepSource.stepsBetween(new Date(from), now).catch(() => slices.reduce((a, b) => a + b, 0));
  const energy = energyToday(energyOf(steps, activeMinutes), await getSetting(db, ENERGY_KEY), day);
  await Promise.all([
    setSetting(db, STEPS_SLICES_KEY, JSON.stringify({ day, slices })),
    setSetting(db, ENERGY_KEY, JSON.stringify({ day, value: energy })),
  ]);
  return { enabled: true, status: 'ok', steps, slices, activeMinutes, energy, day, loadedAt: Date.now() };
}

// ---- live store ----
let current: StepsToday | null = null;
const listeners = new Set<(d: StepsToday) => void>();
function publish(d: StepsToday) {
  current = d;
  listeners.forEach((l) => l(d));
}
/**
 * A fresh read never shows fewer steps, or less energy, than were already shown today (the sensor's
 * history can lag live counts); a higher energy kept this way is saved too.
 */
function publishLoaded(d: StepsToday, db: SQLiteDatabase) {
  const c = current;
  if (!c || c.day !== d.day || c.status !== 'ok' || d.status !== 'ok') return publish(d);
  const energy = Math.max(d.energy, c.energy);
  if (energy > d.energy) setSetting(db, ENERGY_KEY, JSON.stringify({ day: d.day, value: energy })).catch(() => {});
  publish({ ...d, steps: Math.max(d.steps, c.steps), energy });
}

let loading: Promise<void> | null = null;
let again = false;
/** Loads (one at a time; a request during a load runs once more after it). */
function reload(db: SQLiteDatabase) {
  if (loading) {
    again = true;
    return;
  }
  loading = loadSteps(db)
    .then((d) => publishLoaded(d, db))
    .catch(() => {})
    .finally(() => {
      loading = null;
      if (again) {
        again = false;
        reload(db);
      }
    });
}

/** Ask every steps view to reload (e.g. after the setting changes). */
export function refreshSteps(db: SQLiteDatabase) {
  reload(db);
}

/** Live steps arriving while Home is open: added to today's total (and the energy follows). */
function addLiveSteps(n: number, db: SQLiteDatabase) {
  const d = current;
  if (!d || d.status !== 'ok' || n <= 0) return;
  const steps = d.steps + n;
  const energy = Math.max(d.energy, energyOf(steps, d.activeMinutes));
  // Saved every 5 points while walking (not on every step); a fresh read saves it exactly.
  if (Math.floor(energy / 5) !== Math.floor(d.energy / 5)) setSetting(db, ENERGY_KEY, JSON.stringify({ day: d.day, value: energy })).catch(() => {});
  publish({ ...d, steps, energy });
}

export function useStepsToday(): StepsToday | null {
  const db = useSQLiteContext();
  const [data, setData] = useState<StepsToday | null>(current);
  const today = useTodayKey();
  useEffect(() => {
    listeners.add(setData);
    return () => {
      listeners.delete(setData);
    };
  }, []);
  const load = useCallback(() => reload(db), [db]);
  // A new day reloads (the first load comes from the screen coming into view).
  const lastDay = useRef(today);
  useEffect(() => {
    if (lastDay.current === today) return;
    lastDay.current = today;
    load();
  }, [load, today]);
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (s) => {
      if (last === 'background' && s === 'active') load();
      last = s;
    });
    return () => sub.remove();
  }, [load]);
  useFocusEffect(load);
  // Yesterday's numbers are never shown as today's.
  return data && data.day === today ? data : null;
}

/** How long after the last live update the cadence is checked again (it falls to 0 once you stop). */
const RECHECK_MS = 2_500;

/**
 * Your live gait (0 still, 1 walk, 2 run) while `on` (Home in view, app active,
 * the setting on), from the cadence over the last 10 s. Steps arrive from the
 * sensor every few seconds while you walk; after the last one the cadence is
 * checked a few more times until it reaches 0, then nothing runs until the
 * next step. Only a change of gait re-renders.
 */
export function useLiveSteps(on: boolean): number {
  const db = useSQLiteContext();
  const [gait, setGait] = useState<Gait>('idle');
  const samples = useRef<StepSample[]>([]);
  useEffect(() => {
    if (!on) return;
    // Counting starts now, at 0: the first update's steps are measured from here.
    samples.current = [{ t: Date.now(), steps: 0 }];
    let lastCount = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const now = Date.now();
      samples.current = trimSamples(samples.current, now);
      const spm = cadenceOf(samples.current, now);
      setGait((g) => nextGait(g, spm));
      clearTimeout(timer);
      if (spm > 0) timer = setTimeout(measure, RECHECK_MS);
    };
    const stop = stepSource.watch((count) => {
      addLiveSteps(count - lastCount, db);
      lastCount = count;
      samples.current.push({ t: Date.now(), steps: count });
      measure();
    });
    return () => {
      stop();
      clearTimeout(timer);
      setGait('idle'); // the next watch starts from still
    };
  }, [on, db]);
  return on ? gaitLevel(gait) : 0;
}
