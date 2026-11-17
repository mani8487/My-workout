/**
 * The shapes of the things we store. Think of each type as the columns
 * of one table in a spreadsheet.
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

/** One exercise in the library, e.g. "Bench Press". */
export type Exercise = {
  id: string;
  name: string;
  /** Muscles worked, main one first. Stored as "chest,triceps,shoulders". */
  muscles: MuscleGroup[];
  equipment: Equipment;
  /** How much the suggestion adds when you've earned an increase. */
  incrementKg: number;
  isCustom: boolean;
};

export type WorkoutId = 'push' | 'pull' | 'legs' | 'shoulders_arms' | 'full_body';

/** One of the five days in the split. */
export type Workout = {
  id: WorkoutId;
  name: string;
  /** Short label shown on cards, e.g. "Chest · Shoulders · Triceps". */
  muscleLabel: string;
  /** Apple SF Symbol name for the icon. */
  icon: string;
  sortOrder: number;
};

/** One line of a workout's plan, e.g. "Bench Press, 4 sets of 6–8". */
export type PlanItem = {
  id: number;
  workoutId: WorkoutId;
  exerciseId: string;
  position: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
};
