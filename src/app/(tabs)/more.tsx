/**
 * More tab. TEMPORARY for Step 1: shows what's in the database so you can
 * check that saving and loading works. The real More tab (plan editor,
 * exercise library, plate calculator, Settings) is built in Step 10.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { getAllExercises, getPlanForWorkout, getWorkouts, type PlannedExercise } from '@/db/plan';
import { getSetting } from '@/db/settings';
import type { Workout } from '@/db/types';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type Loaded = {
  opens: number;
  exerciseCount: number;
  workouts: { workout: Workout; plan: PlannedExercise[] }[];
};

export default function MoreScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    (async () => {
      const [opens, exercises, workouts] = await Promise.all([
        getSetting(db, 'app_opens'),
        getAllExercises(db),
        getWorkouts(db),
      ]);
      const withPlans = await Promise.all(
        workouts.map(async (workout) => ({ workout, plan: await getPlanForWorkout(db, workout.id) })),
      );
      setData({ opens: Number(opens ?? 0), exerciseCount: exercises.length, workouts: withPlans });
    })();
  }, [db]);

  return (
    <Screen>
      <AppText variant="title">Your Plan</AppText>
      <AppText muted>
        Temporary check screen for Step 1. The plan editor arrives in Step 10.
      </AppText>

      {data && (
        <>
          <Card>
            <AppText variant="label">Database check</AppText>
            <AppText muted>App started {data.opens} {data.opens === 1 ? 'time' : 'times'}</AppText>
            <AppText muted>{data.exerciseCount} exercises in the library</AppText>
          </Card>

          {data.workouts.map(({ workout, plan }) => (
            <Card key={workout.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <SymbolView name={workout.icon as SFSymbol} size={26} tintColor={colors.accent} />
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{workout.name}</AppText>
                  <AppText variant="small" muted>
                    {workout.muscleLabel} · {plan.length} exercises
                  </AppText>
                </View>
              </View>
              <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                {plan.map((p) => (
                  <View key={p.planItemId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText>{p.exercise.name}</AppText>
                    <AppText muted>
                      {p.targetSets} × {p.repMin}–{p.repMax}
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
