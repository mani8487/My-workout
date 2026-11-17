/** One routine: its workouts (tap to edit exercises), add a workout, make it active, rename or delete. */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ListRow, Section } from '@/components/list';
import { Page } from '@/components/page';
import {
  deleteRoutine,
  getActiveRoutineId,
  getPlanForWorkout,
  getRoutines,
  getWorkouts,
  renameRoutine,
  setActiveRoutine,
} from '@/db/plan';
import type { Routine, Workout } from '@/db/types';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

export default function RoutineScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [rows, setRows] = useState<{ workout: Workout; count: number }[]>([]);

  const refresh = useCallback(async () => {
    setRoutine((await getRoutines(db)).find((r) => r.id === routineId) ?? null);
    setIsActive((await getActiveRoutineId(db)) === routineId);
    const ws = await getWorkouts(db, routineId);
    setRows(await Promise.all(ws.map(async (w) => ({ workout: w, count: (await getPlanForWorkout(db, w.id)).length }))));
  }, [db, routineId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (!routine) return <Page title="">{null}</Page>;

  function rename() {
    Alert.prompt(
      'Rename Routine',
      undefined,
      async (name) => {
        if (name?.trim()) {
          await renameRoutine(db, routineId, name);
          refresh();
        }
      },
      'plain-text',
      routine!.name,
    );
  }

  function confirmDelete() {
    Alert.alert(`Delete ${routine!.name}?`, 'Its workouts and plans are removed. Past sessions stay in History.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await deleteRoutine(db, routineId)) router.back();
          else Alert.alert('Only routine', 'You need at least one routine. Create another one first, then delete this.');
        },
      },
    ]);
  }

  return (
    <Page
      title={routine.name}
      footer={
        <Button
          title="+ New Workout"
          kind="secondary"
          onPress={() => router.push({ pathname: '/workout-new', params: { routineId } })}
        />
      }>
      {isActive ? (
        <AppText muted>This is your active routine. Home suggests its workouts in order.</AppText>
      ) : (
        <Button
          title="Make This My Active Routine"
          onPress={async () => {
            await setActiveRoutine(db, routineId);
            refresh();
          }}
        />
      )}

      {rows.length === 0 ? (
        <AppText muted>No workouts yet. Tap + New Workout.</AppText>
      ) : (
        <Section title="Workouts, in rotation order">
          {rows.map(({ workout, count }) => (
            <ListRow
              key={workout.id}
              icon={workout.icon as SFSymbol}
              title={workout.name}
              subtitle={`${count} exercises · ${workout.muscleLabel}`}
              onPress={() => router.push({ pathname: '/plan/[workoutId]', params: { workoutId: workout.id } })}
            />
          ))}
        </Section>
      )}

      {/* Routine actions, visible (not hidden in a menu). */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <Button title="Rename" kind="secondary" style={{ flex: 1 }} onPress={rename} />
        <Pressable
          onPress={confirmDelete}
          accessibilityLabel="Delete routine"
          style={{
            flex: 1,
            minHeight: MIN_TAP,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText variant="label" color={colors.danger}>
            Delete Routine
          </AppText>
        </Pressable>
      </View>
    </Page>
  );
}
