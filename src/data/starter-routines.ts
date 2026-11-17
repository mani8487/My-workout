/**
 * Your three starter plans, loaded once as separate routines.
 * Where a plan says "X or Y", the first option is used; swap freely in the app.
 * Each line: [exercise name from the library, sets, lowest reps, highest reps]
 */
type Line = [string, number, number, number];
type StarterWorkout = { name: string; muscleLabel: string; icon: string; lines: Line[] };
export type StarterRoutine = { name: string; workouts: StarterWorkout[] };

export const STARTER_ROUTINES: StarterRoutine[] = [
  {
    name: 'PPL + Upper/Lower (5 days)',
    workouts: [
      {
        name: 'Push',
        muscleLabel: 'Chest · Shoulders · Triceps',
        icon: 'figure.strengthtraining.traditional',
        lines: [
          ['Bench Press', 3, 6, 8],
          ['Incline Dumbbell Press', 3, 8, 10],
          ['Seated Dumbbell Press', 3, 8, 10],
          ['Cable Lateral Raise', 3, 12, 15],
          ['Triceps Pushdown', 3, 10, 12],
          ['Overhead Triceps Extension', 2, 12, 15],
        ],
      },
      {
        name: 'Pull',
        muscleLabel: 'Back · Biceps · Rear delts',
        icon: 'figure.rower',
        lines: [
          ['Pull-Up', 3, 6, 10],
          ['Chest-Supported Row', 3, 8, 10],
          ['Seated Cable Row', 3, 10, 12],
          ['Face Pull', 3, 12, 15],
          ['Incline Dumbbell Curl', 3, 10, 12],
          ['Hammer Curl', 2, 10, 12],
        ],
      },
      {
        name: 'Legs',
        muscleLabel: 'Quads · Hamstrings · Calves',
        icon: 'figure.step.training',
        lines: [
          ['Back Squat', 3, 6, 8],
          ['Romanian Deadlift', 3, 8, 10],
          ['Leg Press', 3, 10, 12],
          ['Lying Leg Curl', 3, 10, 12],
          ['Leg Extension', 2, 12, 15],
          ['Standing Calf Raise', 3, 10, 15],
        ],
      },
      {
        name: 'Upper',
        muscleLabel: 'Chest · Back · Shoulders · Arms',
        icon: 'dumbbell.fill',
        lines: [
          ['Incline Bench Press', 3, 8, 10],
          ['Lat Pulldown', 3, 8, 10],
          ['Seated Cable Row', 3, 10, 12],
          ['Pec Deck', 2, 12, 15],
          ['Lateral Raise', 3, 12, 15],
          ['EZ-Bar Curl', 2, 10, 12],
          ['Triceps Pushdown', 2, 10, 12],
        ],
      },
      {
        name: 'Lower',
        muscleLabel: 'Quads · Glutes · Hamstrings · Core',
        icon: 'figure.cross.training',
        lines: [
          ['Bulgarian Split Squat', 3, 8, 10],
          ['Hip Thrust', 3, 8, 10],
          ['Seated Leg Curl', 3, 10, 12],
          ['Leg Extension', 3, 12, 15],
          ['Seated Calf Raise', 3, 12, 15],
          ['Hanging Leg Raise', 3, 10, 15],
        ],
      },
    ],
  },
  {
    name: 'Upper / Lower (4 days)',
    workouts: [
      {
        name: 'Upper A',
        muscleLabel: 'Chest · Back · Shoulders · Triceps',
        icon: 'dumbbell.fill',
        lines: [
          ['Bench Press', 3, 5, 8],
          ['Barbell Row', 3, 6, 8],
          ['Overhead Press', 3, 6, 10],
          ['Lat Pulldown', 3, 8, 10],
          ['Cable Lateral Raise', 3, 12, 15],
          ['Triceps Pushdown', 2, 10, 12],
        ],
      },
      {
        name: 'Lower A',
        muscleLabel: 'Quads · Hamstrings · Calves',
        icon: 'figure.step.training',
        lines: [
          ['Back Squat', 3, 5, 8],
          ['Romanian Deadlift', 3, 6, 10],
          ['Leg Press', 2, 10, 12],
          ['Seated Leg Curl', 3, 10, 12],
          ['Standing Calf Raise', 3, 8, 12],
        ],
      },
      {
        name: 'Upper B',
        muscleLabel: 'Chest · Back · Shoulders · Arms',
        icon: 'figure.strengthtraining.traditional',
        lines: [
          ['Incline Dumbbell Press', 3, 8, 10],
          ['Pull-Up', 3, 6, 10],
          ['Seated Dumbbell Press', 3, 8, 10],
          ['Seated Cable Row', 3, 10, 12],
          ['Reverse Pec Deck', 3, 12, 15],
          ['Overhead Triceps Extension', 2, 10, 12],
          ['Incline Dumbbell Curl', 2, 10, 12],
        ],
      },
      {
        name: 'Lower B',
        muscleLabel: 'Quads · Glutes · Hamstrings · Calves',
        icon: 'figure.cross.training',
        lines: [
          ['Hack Squat', 3, 8, 10],
          ['Hip Thrust', 3, 8, 10],
          ['Walking Lunge', 2, 10, 10], // 10 each leg
          ['Leg Extension', 3, 12, 15],
          ['Lying Leg Curl', 3, 10, 12],
          ['Seated Calf Raise', 3, 12, 15],
        ],
      },
    ],
  },
  {
    name: 'Full Body (3 days)',
    workouts: [
      {
        name: 'Full Body A',
        muscleLabel: 'Whole body',
        icon: 'figure.strengthtraining.functional',
        lines: [
          ['Back Squat', 3, 6, 8],
          ['Bench Press', 3, 6, 8],
          ['Chest-Supported Row', 3, 8, 10],
          ['Lateral Raise', 2, 12, 15],
          ['Lying Leg Curl', 2, 10, 12],
          ['Triceps Pushdown', 2, 10, 12],
        ],
      },
      {
        name: 'Full Body B',
        muscleLabel: 'Whole body',
        icon: 'figure.cross.training',
        lines: [
          ['Romanian Deadlift', 3, 6, 8],
          ['Overhead Press', 3, 6, 8],
          ['Lat Pulldown', 3, 8, 10],
          ['Incline Dumbbell Press', 2, 8, 10],
          ['Standing Calf Raise', 2, 10, 15],
          ['Dumbbell Curl', 2, 10, 12],
        ],
      },
      {
        name: 'Full Body C',
        muscleLabel: 'Whole body',
        icon: 'figure.core.training',
        lines: [
          ['Leg Press', 3, 8, 10],
          ['Incline Dumbbell Press', 3, 8, 10],
          ['Seated Cable Row', 3, 8, 10],
          ['Seated Dumbbell Press', 2, 8, 12],
          ['Hip Thrust', 2, 8, 10],
          ['Hammer Curl', 2, 10, 12],
        ],
      },
    ],
  },
];
