/**
 * The built-in exercise library. Names are kept short so they read at a glance.
 * Muscles are listed main-muscle first; those tags power swap suggestions and
 * the weekly muscle-group view later.
 *
 * To add a built-in exercise later, just add a line. The app inserts any new
 * ones on next start without touching your custom exercises or history.
 */
import type { Equipment, MuscleGroup } from '@/db/types';

type LibraryEntry = {
  name: string;
  muscles: MuscleGroup[];
  equipment: Equipment;
  /** Defaults: dumbbells +2 kg, everything else +2.5 kg. */
  incrementKg?: number;
};

const ENTRIES: LibraryEntry[] = [
  // Chest
  { name: 'Bench Press', muscles: ['chest', 'triceps', 'shoulders'], equipment: 'barbell' },
  { name: 'Incline Bench Press', muscles: ['chest', 'shoulders', 'triceps'], equipment: 'barbell' },
  { name: 'Dumbbell Bench Press', muscles: ['chest', 'triceps', 'shoulders'], equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Press', muscles: ['chest', 'shoulders', 'triceps'], equipment: 'dumbbell' },
  { name: 'Machine Chest Press', muscles: ['chest', 'triceps', 'shoulders'], equipment: 'machine' },
  { name: 'Cable Fly', muscles: ['chest'], equipment: 'cable' },
  { name: 'Pec Deck', muscles: ['chest'], equipment: 'machine' },
  { name: 'Push-Up', muscles: ['chest', 'triceps', 'shoulders'], equipment: 'bodyweight' },
  { name: 'Dip', muscles: ['chest', 'triceps', 'shoulders'], equipment: 'bodyweight' },

  // Back
  { name: 'Deadlift', muscles: ['back', 'hamstrings', 'glutes'], equipment: 'barbell' },
  { name: 'Pull-Up', muscles: ['back', 'biceps'], equipment: 'bodyweight' },
  { name: 'Chin-Up', muscles: ['back', 'biceps'], equipment: 'bodyweight' },
  { name: 'Lat Pulldown', muscles: ['back', 'biceps'], equipment: 'cable' },
  { name: 'Barbell Row', muscles: ['back', 'biceps'], equipment: 'barbell' },
  { name: 'Dumbbell Row', muscles: ['back', 'biceps'], equipment: 'dumbbell' },
  { name: 'Seated Cable Row', muscles: ['back', 'biceps'], equipment: 'cable' },
  { name: 'Chest-Supported Row', muscles: ['back', 'biceps'], equipment: 'machine' },
  { name: 'T-Bar Row', muscles: ['back', 'biceps'], equipment: 'barbell' },
  { name: 'Straight-Arm Pulldown', muscles: ['back'], equipment: 'cable' },
  { name: 'Shrug', muscles: ['back'], equipment: 'dumbbell' },

  // Shoulders
  { name: 'Overhead Press', muscles: ['shoulders', 'triceps'], equipment: 'barbell' },
  { name: 'Seated Dumbbell Press', muscles: ['shoulders', 'triceps'], equipment: 'dumbbell' },
  { name: 'Arnold Press', muscles: ['shoulders', 'triceps'], equipment: 'dumbbell' },
  { name: 'Machine Shoulder Press', muscles: ['shoulders', 'triceps'], equipment: 'machine' },
  { name: 'Lateral Raise', muscles: ['shoulders'], equipment: 'dumbbell', incrementKg: 1 },
  { name: 'Cable Lateral Raise', muscles: ['shoulders'], equipment: 'cable', incrementKg: 1.25 },
  { name: 'Rear Delt Fly', muscles: ['shoulders', 'back'], equipment: 'dumbbell', incrementKg: 1 },
  { name: 'Reverse Pec Deck', muscles: ['shoulders', 'back'], equipment: 'machine' },
  { name: 'Face Pull', muscles: ['shoulders', 'back'], equipment: 'cable' },

  // Biceps
  { name: 'Barbell Curl', muscles: ['biceps'], equipment: 'barbell' },
  { name: 'EZ-Bar Curl', muscles: ['biceps'], equipment: 'barbell' },
  { name: 'Dumbbell Curl', muscles: ['biceps'], equipment: 'dumbbell' },
  { name: 'Hammer Curl', muscles: ['biceps'], equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Curl', muscles: ['biceps'], equipment: 'dumbbell' },
  { name: 'Cable Curl', muscles: ['biceps'], equipment: 'cable' },
  { name: 'Preacher Curl', muscles: ['biceps'], equipment: 'machine' },

  // Triceps
  { name: 'Triceps Pushdown', muscles: ['triceps'], equipment: 'cable' },
  { name: 'Overhead Triceps Extension', muscles: ['triceps'], equipment: 'cable' },
  { name: 'Skull Crusher', muscles: ['triceps'], equipment: 'barbell' },
  { name: 'Close-Grip Bench Press', muscles: ['triceps', 'chest'], equipment: 'barbell' },

  // Legs
  { name: 'Back Squat', muscles: ['quads', 'glutes'], equipment: 'barbell' },
  { name: 'Front Squat', muscles: ['quads', 'glutes', 'core'], equipment: 'barbell' },
  { name: 'Leg Press', muscles: ['quads', 'glutes'], equipment: 'machine', incrementKg: 5 },
  { name: 'Hack Squat', muscles: ['quads', 'glutes'], equipment: 'machine', incrementKg: 5 },
  { name: 'Romanian Deadlift', muscles: ['hamstrings', 'glutes', 'back'], equipment: 'barbell' },
  { name: 'Bulgarian Split Squat', muscles: ['quads', 'glutes'], equipment: 'dumbbell' },
  { name: 'Walking Lunge', muscles: ['quads', 'glutes'], equipment: 'dumbbell' },
  { name: 'Leg Extension', muscles: ['quads'], equipment: 'machine' },
  { name: 'Seated Leg Curl', muscles: ['hamstrings'], equipment: 'machine' },
  { name: 'Lying Leg Curl', muscles: ['hamstrings'], equipment: 'machine' },
  { name: 'Hip Thrust', muscles: ['glutes', 'hamstrings'], equipment: 'barbell', incrementKg: 5 },
  { name: 'Standing Calf Raise', muscles: ['calves'], equipment: 'machine' },
  { name: 'Seated Calf Raise', muscles: ['calves'], equipment: 'machine' },

  // Core
  { name: 'Cable Crunch', muscles: ['core'], equipment: 'cable' },
  { name: 'Hanging Leg Raise', muscles: ['core'], equipment: 'bodyweight' },
  { name: 'Ab Wheel Rollout', muscles: ['core'], equipment: 'bodyweight' },
];

/** Turns "Incline Dumbbell Press" into "incline-dumbbell-press" for a stable ID. */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const EXERCISE_LIBRARY = ENTRIES.map((e) => ({
  id: slugify(e.name),
  name: e.name,
  muscles: e.muscles,
  equipment: e.equipment,
  incrementKg: e.incrementKg ?? (e.equipment === 'dumbbell' ? 2 : 2.5),
}));
