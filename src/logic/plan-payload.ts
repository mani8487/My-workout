/**
 * Checks a plan that arrived from a friend before it touches your phone's data.
 *
 * Anything sent over the internet can be malformed or deliberately oversized, so
 * this keeps only well-formed workouts and exercises, trims text, clamps numbers
 * to sensible gym ranges and caps how much can be imported. Returns null when
 * nothing usable is left.
 */
import type { Equipment, MuscleGroup } from '@/db/types';

export type PlanPayload = {
  workouts: {
    name: string;
    muscleLabel: string;
    icon: string;
    items: {
      exerciseId: string;
      name: string;
      muscles: MuscleGroup[];
      equipment: Equipment;
      incrementKg: number;
      sets: number;
      repMin: number;
      repMax: number;
      rest: number;
    }[];
  }[];
};

const MUSCLES: readonly MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];
const EQUIPMENT: readonly Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const MAX_WORKOUTS = 14;
const MAX_ITEMS = 20;

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

export function parsePlanPayload(raw: unknown): PlanPayload | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { workouts?: unknown }).workouts)) return null;
  const workouts: PlanPayload['workouts'] = [];

  for (const w of (raw as { workouts: unknown[] }).workouts.slice(0, MAX_WORKOUTS)) {
    if (!w || typeof w !== 'object') continue;
    const wo = w as Record<string, unknown>;
    const name = text(wo.name, 40);
    if (!name || !Array.isArray(wo.items)) continue;

    const items: PlanPayload['workouts'][number]['items'] = [];
    for (const it of wo.items.slice(0, MAX_ITEMS)) {
      if (!it || typeof it !== 'object') continue;
      const i = it as Record<string, unknown>;
      // Exercise ids are short slugs (e.g. "bench_press", "custom-cable-fly").
      const exerciseId = text(i.exerciseId, 60);
      const exName = text(i.name, 60);
      if (!/^[a-z0-9_-]+$/.test(exerciseId) || !exName) continue;
      const muscles = (Array.isArray(i.muscles) ? i.muscles : []).filter((m): m is MuscleGroup =>
        MUSCLES.includes(m as MuscleGroup),
      );
      const repMin = int(i.repMin, 1, 50, 8);
      items.push({
        exerciseId,
        name: exName,
        muscles: muscles.length ? muscles.slice(0, 4) : ['core'],
        equipment: EQUIPMENT.includes(i.equipment as Equipment) ? (i.equipment as Equipment) : 'machine',
        incrementKg: typeof i.incrementKg === 'number' && Number.isFinite(i.incrementKg) ? Math.min(10, Math.max(0.5, i.incrementKg)) : 2.5,
        sets: int(i.sets, 1, 10, 3),
        repMin,
        repMax: int(i.repMax, repMin, 50, Math.max(repMin, 12)),
        rest: int(i.rest, 15, 600, 90),
      });
    }
    if (items.length === 0) continue;

    const icon = text(wo.icon, 60);
    workouts.push({
      name,
      muscleLabel: text(wo.muscleLabel, 60),
      // SF Symbol names only ("figure.rower"); anything else falls back to a dumbbell.
      icon: /^[a-z0-9.]+$/.test(icon) ? icon : 'dumbbell.fill',
      items,
    });
  }
  return workouts.length ? { workouts } : null;
}
