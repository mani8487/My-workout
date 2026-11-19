/** Workout Preview: target muscles, exercise list with rep targets, estimated time, then Start. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { getWorkouts, type PlannedExercise } from '@/db/plan';
import { getActiveSessionId, startSession } from '@/db/sessions';
import type { Workout, WorkoutId } from '@/db/types';
import { titleCase } from '@/logic/format';
import { getWorkoutPreview } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function PreviewScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: WorkoutId }>();
  const [data, setData] = useState<{ workout: Workout; plan: PlannedExercise[]; minutes: number } | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      const workout = (await getWorkouts(db)).find((w) => w.id === id);
      if (!workout) return;
      const { plan, minutes } = await getWorkoutPreview(db, workout.id);
      setData({ workout, plan, minutes });
    })();
  }, [db, id]);

  async function start() {
    if (!data || starting) return; // guard against a double-tap
    setStarting(true);
    try {
      if ((await getActiveSessionId(db)) == null) {
        await startSession(db, data.workout.id, data.workout.name);
      }
      router.replace('/workout/active');
    } finally {
      setStarting(false);
    }
  }

  if (!data) return <SkeletonScreen />;
  const totalSets = data.plan.reduce((n, p) => n + p.targetSets, 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Workout Preview" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <SymbolView name={data.workout.icon as SFSymbol} size={40} tintColor={colors.accent} />
          <View style={{ flex: 1 }}>
            <AppText variant="title">{data.workout.name}</AppText>
            <AppText muted>{data.workout.muscleLabel}</AppText>
          </View>
        </View>

        <AppText variant="label">
          {data.plan.length} exercises · {totalSets} sets · about {data.minutes} min
        </AppText>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
          {data.plan.map((p, i) => (
            <View
              key={p.planItemId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}>
              <AppText variant="label" muted style={{ width: 20 }}>
                {i + 1}
              </AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{p.exercise.name}</AppText>
                <AppText variant="small" muted>
                  {p.exercise.muscles.map(titleCase).join(' · ')}
                </AppText>
              </View>
              <AppText muted>
                {p.targetSets} × {p.repMin}–{p.repMax}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Button title="Start Workout" size="large" onPress={start} />
      </View>
    </SafeAreaView>
  );
}
