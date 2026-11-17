/**
 * The five workouts and a STARTER plan for each.
 * This is only loaded the very first time the app runs. After that, your plan
 * lives in the database and you change it in the plan editor (Step 10).
 */
import type { Workout, WorkoutId } from '@/db/types';
import { slugify } from './exercise-library';

export const WORKOUTS: Workout[] = [
  { id: 'push', name: 'Push', muscleLabel: 'Chest · Shoulders · Triceps', icon: 'figure.strengthtraining.traditional', sortOrder: 1 },
  { id: 'pull', name: 'Pull', muscleLabel: 'Back · Biceps · Rear delts', icon: 'figure.rower', sortOrder: 2 },
  { id: 'legs', name: 'Legs', muscleLabel: 'Quads · Hamstrings · Glutes · Calves', icon: 'figure.step.training', sortOrder: 3 },
  { id: 'shoulders_arms', name: 'Shoulders & Arms', muscleLabel: 'Shoulders · Biceps · Triceps', icon: 'dumbbell.fill', sortOrder: 4 },
  { id: 'full_body', name: 'Full Body', muscleLabel: 'Whole body', icon: 'figure.cross.training', sortOrder: 5 },
];

/** [exercise name, sets, lowest reps, highest reps] */
type Line = [string, number, number, number];

const PLAN: Record<WorkoutId, Line[]> = {
  push: [
    ['Bench Press', 4, 6, 8],
    ['Incline Dumbbell Press', 3, 8, 10],
    ['Seated Dumbbell Press', 3, 8, 10],
    ['Cable Fly', 3, 10, 12],
    ['Lateral Raise', 3, 12, 15],
    ['Triceps Pushdown', 3, 10, 12],
  ],
  pull: [
    ['Pull-Up', 4, 6, 8],
    ['Barbell Row', 4, 6, 8],
    ['Lat Pulldown', 3, 8, 10],
    ['Seated Cable Row', 3, 10, 12],
    ['Face Pull', 3, 12, 15],
    ['Barbell Curl', 3, 8, 10],
  ],
  legs: [
    ['Back Squat', 4, 6, 8],
    ['Romanian Deadlift', 3, 8, 10],
    ['Leg Press', 3, 10, 12],
    ['Seated Leg Curl', 3, 10, 12],
    ['Leg Extension', 3, 12, 15],
    ['Standing Calf Raise', 4, 10, 15],
  ],
  shoulders_arms: [
    ['Overhead Press', 4, 6, 8],
    ['Lateral Raise', 4, 12, 15],
    ['Rear Delt Fly', 3, 12, 15],
    ['EZ-Bar Curl', 3, 8, 10],
    ['Skull Crusher', 3, 8, 10],
    ['Hammer Curl', 3, 10, 12],
    ['Overhead Triceps Extension', 3, 10, 12],
  ],
  full_body: [
    ['Deadlift', 3, 5, 6],
    ['Dumbbell Bench Press', 3, 8, 10],
    ['Chest-Supported Row', 3, 8, 10],
    ['Bulgarian Split Squat', 3, 8, 10],
    ['Cable Crunch', 3, 12, 15],
  ],
};

export const DEFAULT_REST_SECONDS = 120;

export const DEFAULT_PLAN = (Object.keys(PLAN) as WorkoutId[]).flatMap((workoutId) =>
  PLAN[workoutId].map(([name, sets, repMin, repMax], index) => ({
    workoutId,
    exerciseId: slugify(name),
    position: index + 1,
    targetSets: sets,
    repMin,
    repMax,
    restSeconds: DEFAULT_REST_SECONDS,
  })),
);
