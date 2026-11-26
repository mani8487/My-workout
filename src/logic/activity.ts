/**
 * Quick Log: the activities you can log in a few taps, and the simple rules for
 * turning them into "active minutes". Change the numbers here and the whole app
 * follows (Home ring, suggestions, week view).
 */
import type { MuscleGroup } from '@/db/types';

/** Rough rule: 10 reps of a bodyweight move take about 1 minute. */
export const REPS_PER_MINUTE = 10;
/** Daily goal for the "Active today" ring until you change it in Settings. */
export const DEFAULT_ACTIVE_GOAL_MIN = 30;
/** Settings key for the daily goal. */
export const ACTIVE_GOAL_KEY = 'active_goal_min';

export type ActivityUnit = 'reps' | 'min';
export type ActivityGroup = 'legs' | 'upper' | 'core' | 'cardio' | 'mobility';

export const GROUP_LABELS: Record<ActivityGroup, string> = {
  legs: 'Legs',
  upper: 'Upper body',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

export type ActivityPreset = {
  id: string;
  name: string;
  unit: ActivityUnit;
  group: ActivityGroup;
  /** Quick-select amounts; the middle one is the default. */
  chips: number[];
  /** Run, swim and cycling can also take a distance. */
  distance?: boolean;
  icon: string;
};

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { id: 'squats', name: 'Squats', unit: 'reps', group: 'legs', chips: [10, 15, 20, 30], icon: 'figure.strengthtraining.functional' },
  { id: 'pushups', name: 'Push-ups', unit: 'reps', group: 'upper', chips: [10, 15, 20, 30], icon: 'figure.strengthtraining.traditional' },
  { id: 'plank', name: 'Plank', unit: 'min', group: 'core', chips: [1, 2, 3, 5], icon: 'figure.core.training' },
  { id: 'walk', name: 'Walk', unit: 'min', group: 'cardio', chips: [10, 20, 30, 45], icon: 'figure.walk' },
  { id: 'run', name: 'Run', unit: 'min', group: 'cardio', chips: [10, 20, 30, 45], distance: true, icon: 'figure.run' },
  { id: 'swim', name: 'Swim', unit: 'min', group: 'cardio', chips: [15, 20, 30, 45], distance: true, icon: 'figure.pool.swim' },
  { id: 'yoga', name: 'Yoga', unit: 'min', group: 'mobility', chips: [10, 20, 30, 45], icon: 'figure.yoga' },
  { id: 'stretch', name: 'Stretch', unit: 'min', group: 'mobility', chips: [5, 10, 15, 20], icon: 'figure.flexibility' },
  { id: 'cycling', name: 'Cycling', unit: 'min', group: 'cardio', chips: [10, 20, 30, 45], distance: true, icon: 'figure.outdoor.cycle' },
];

/** Active minutes for one logged amount. */
export function activeMinutes(amount: number, unit: ActivityUnit): number {
  return unit === 'reps' ? amount / REPS_PER_MINUTE : amount;
}

/** Which Quick Log group a gym muscle belongs to (for comparing logs with workouts). */
export function groupForMuscle(m: MuscleGroup): ActivityGroup {
  if (m === 'quads' || m === 'hamstrings' || m === 'glutes' || m === 'calves') return 'legs';
  if (m === 'core') return 'core';
  return 'upper';
}

/** "15 squats", "20 min walk", "2 min plank". */
export function describeLog(name: string, amount: number, unit: ActivityUnit): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  return unit === 'reps' ? `${n} ${name.toLowerCase()}` : `${n} min ${name.toLowerCase()}`;
}

type LogLike = { id: number; activity: string; name: string; amount: number; unit: ActivityUnit; loggedAt: number };

/**
 * Logs of the same activity (and unit) combined into one entry, so two walks
 * show as "40 min walk" instead of "20 min walk · 20 min walk". Ordered by
 * each activity's first log of the day; `logs` keeps the originals (to delete one).
 */
export function groupLogs<T extends LogLike>(logs: readonly T[]): { key: string; name: string; activity: string; unit: ActivityUnit; amount: number; logs: T[] }[] {
  const groups = new Map<string, { key: string; name: string; activity: string; unit: ActivityUnit; amount: number; logs: T[] }>();
  for (const l of [...logs].sort((a, b) => a.loggedAt - b.loggedAt || a.id - b.id)) {
    const key = `${l.activity}|${l.unit}`;
    const g = groups.get(key);
    if (g) {
      g.amount += l.amount;
      g.logs.push(l);
    } else groups.set(key, { key, name: l.name, activity: l.activity, unit: l.unit, amount: l.amount, logs: [l] });
  }
  return [...groups.values()];
}
