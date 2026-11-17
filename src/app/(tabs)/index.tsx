/**
 * Home: greeting, today's workout (first one still owed in the cycle, or
 * your Change Workout pick), Start Workout, Change Workout, and a quote.
 * If a workout is in progress, it offers to resume it instead.
 */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { quoteOfTheDay } from '@/data/quotes';
import { getSetting } from '@/db/settings';
import { getActiveSessionId, getSessionDetail } from '@/db/sessions';
import type { Workout } from '@/db/types';
import type { Rotation } from '@/logic/rotation';
import { getToday, getWorkoutPreview, greeting, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type HomeData = {
  name: string | null;
  rotation: Rotation;
  workout: Workout;
  exerciseCount: number;
  minutes: number;
  active: { name: string; setsDone: number } | null;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [data, setData] = useState<HomeData | null>(null);

  // Reload every time Home comes into view (after a workout, after Change Workout…).
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [{ rotation, workout }, name, activeId] = await Promise.all([
          getToday(db),
          getSetting(db, 'user_name'),
          getActiveSessionId(db),
        ]);
        const { plan, minutes } = await getWorkoutPreview(db, workout.id);
        let active: HomeData['active'] = null;
        if (activeId != null) {
          const d = await getSessionDetail(db, activeId);
          if (d) {
            const setsDone = d.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt != null && !s.isWarmup).length;
            active = { name: d.workoutName, setsDone };
          }
        }
        setData({ name, rotation, workout, exerciseCount: plan.length, minutes, active });
      })();
    }, [db]),
  );

  if (!data) return <Screen>{null}</Screen>;

  const { rotation, workout, active } = data;
  const doneCount = rotation.done.size;
  const isOwed = !rotation.done.has(workout.id);
  const statusLine = isOwed
    ? `${workout.name} is owed · ${doneCount} of ${rotation.workouts.length} done this cycle`
    : `${workout.name} was already done on ${shortDate(rotation.done.get(workout.id)!)} this cycle`;

  const openPreview = () => router.push({ pathname: '/workout/preview', params: { id: workout.id } });

  return (
    <Screen>
      {/* Greeting + settings */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {greeting()}
          {data.name ? `, ${data.name}` : ''}
        </AppText>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Settings">
          <SymbolView name="gearshape" size={24} tintColor={colors.textMuted} />
        </Pressable>
      </View>

      {active ? (
        <>
          <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
            <AppText variant="small" muted>
              IN PROGRESS
            </AppText>
            <AppText variant="heading">{active.name}</AppText>
            <AppText muted>
              {active.setsDone} {active.setsDone === 1 ? 'set' : 'sets'} logged so far
            </AppText>
          </Card>
          <Button title="Resume Workout" size="large" onPress={() => router.push('/workout/active')} />
        </>
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={openPreview} accessibilityLabel={`Preview ${workout.name}`}>
              <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
                <AppText variant="small" muted>
                  TODAY&apos;S WORKOUT
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <SymbolView name={workout.icon as SFSymbol} size={30} tintColor={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">{workout.name}</AppText>
                    <AppText muted>{workout.muscleLabel}</AppText>
                  </View>
                </View>
                <AppText variant="small" muted>
                  {data.exerciseCount} exercises · about {data.minutes} min
                </AppText>
              </Card>
            </Pressable>
            <AppText variant="small" muted style={{ paddingHorizontal: spacing.xs }}>
              {statusLine}
            </AppText>
          </View>

          <Button title="Start Workout" size="large" onPress={openPreview} />
          <Button title="Change Workout" kind="secondary" onPress={() => router.push('/workout/change')} />
        </>
      )}

      <AppText muted style={{ textAlign: 'center', fontStyle: 'italic', marginTop: spacing.lg }}>
        “{quoteOfTheDay()}”
      </AppText>
    </Screen>
  );
}
