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
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { quoteOfTheDay } from '@/data/quotes';
import { getSetting } from '@/db/settings';
import { getActiveSessionId, getSessionDetail } from '@/db/sessions';
import type { Workout } from '@/db/types';
import { acceptFreshStart, dismissFreshStart, freshStartOffer } from '@/logic/fresh-start';
import type { Rotation } from '@/logic/rotation';
import { getToday, getWorkoutPreview, greeting, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type HomeData = {
  name: string | null;
  rotation: Rotation;
  /** Null only when the active routine has no workouts yet. */
  workout: Workout | null;
  exerciseCount: number;
  minutes: number;
  active: { name: string; setsDone: number } | null;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [data, setData] = useState<HomeData | null>(null);
  const [weeksAway, setWeeksAway] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Reload every time Home comes into view (after a workout, after Change Workout…).
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [{ rotation, workout }, name, activeId] = await Promise.all([
          getToday(db),
          getSetting(db, 'user_name'),
          getActiveSessionId(db),
        ]);
        const { plan, minutes } = workout ? await getWorkoutPreview(db, workout.id) : { plan: [], minutes: 0 };
        let active: HomeData['active'] = null;
        if (activeId != null) {
          const d = await getSessionDetail(db, activeId);
          if (d) {
            const setsDone = d.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt != null && !s.isWarmup).length;
            active = { name: d.workoutName, setsDone };
          }
        }
        setData({ name, rotation, workout, exerciseCount: plan.length, minutes, active });
        setWeeksAway(activeId == null ? await freshStartOffer(db) : null);
      })();
    }, [db, reloadKey]),
  );

  if (!data) return <Screen>{null}</Screen>;

  const { rotation, workout, active } = data;
  const doneCount = rotation.done.size;

  // A brand-new routine with no workouts yet.
  if (!workout && !active) {
    return (
      <Screen>
        <AppText variant="title">{greeting()}</AppText>
        <Card>
          <AppText variant="heading">{rotation.routine.name}</AppText>
          <AppText muted>This routine has no workouts yet. Add some in the Plan Editor.</AppText>
          <Button
            title="Open Routine"
            onPress={() => router.push({ pathname: '/routine/[routineId]', params: { routineId: rotation.routine.id } })}
          />
        </Card>
      </Screen>
    );
  }

  const isOwed = workout ? !rotation.done.has(workout.id) : true;
  const statusLine = !workout
    ? ''
    : isOwed
      ? `${workout.name} is owed · ${doneCount} of ${rotation.workouts.length} done this cycle`
      : `${workout.name} was already done on ${shortDate(rotation.done.get(workout.id)!)} this cycle`;

  const openPreview = () => workout && router.push({ pathname: '/workout/preview', params: { id: workout.id } });

  return (
    <Screen>
      {/* Greeting + settings */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {greeting()}
          {data.name ? `, ${data.name}` : ''}
        </AppText>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Settings">
          <SymbolView name="gearshape" size={24} tintColor={colors.textMuted} />
        </Pressable>
      </View>

      {weeksAway != null && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <AppText variant="label" style={{ flex: 1 }}>
              Welcome back. Want to ease in?
            </AppText>
            <Pressable
              onPress={async () => {
                await dismissFreshStart(db);
                setWeeksAway(null);
              }}
              hitSlop={10}
              accessibilityLabel="Dismiss">
              <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
            </Pressable>
          </View>
          <AppText variant="small" muted>
            It&apos;s been {weeksAway} weeks. A fresh start restarts the cycle from Push, with weights about 10% lighter
            for your first session back on each exercise.
          </AppText>
          <Button
            title="Fresh Start"
            kind="secondary"
            onPress={async () => {
              await acceptFreshStart(db);
              setReloadKey((k) => k + 1);
            }}
          />
        </Card>
      )}

      {active ? (
        <>
          <Card style={{ borderColor: colors.accent, padding: spacing.xl }}>
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
        workout && (
        <>
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={openPreview} accessibilityLabel={`Preview ${workout.name}`}>
              <Card style={{ borderColor: colors.accent, padding: spacing.xl }}>
                <AppText variant="small" muted>
                  TODAY&apos;S WORKOUT · {rotation.routine.name.toUpperCase()}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <SymbolView name={workout.icon as SFSymbol} size={30} tintColor={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">{workout.name}</AppText>
                    <AppText muted>{workout.muscleLabel}</AppText>
                  </View>
                  {/* Cycle progress ring, e.g. 2 of 5 */}
                  <ProgressRing size={56} stroke={4} fraction={doneCount / rotation.workouts.length}>
                    <AppText variant="small">
                      {doneCount}/{rotation.workouts.length}
                    </AppText>
                  </ProgressRing>
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
        )
      )}

      <AppText variant="small" muted style={{ textAlign: 'center', marginTop: spacing.lg }}>
        “{quoteOfTheDay()}”
      </AppText>
    </Screen>
  );
}
