/**
 * Plan Editor, top level: your routines. Each routine is a separate set of
 * workouts with its own rotation; one routine is active at a time.
 */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ListRow, Section } from '@/components/list';
import { Page } from '@/components/page';
import { addRoutine, getActiveRoutineId, getRoutines, getWorkouts } from '@/db/plan';
import type { Routine } from '@/db/types';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function RoutinesScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [rows, setRows] = useState<{ routine: Routine; count: number; active: boolean }[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [routines, activeId] = await Promise.all([getRoutines(db), getActiveRoutineId(db)]);
        setRows(
          await Promise.all(
            routines.map(async (r) => ({ routine: r, count: (await getWorkouts(db, r.id)).length, active: r.id === activeId })),
          ),
        );
      })();
    }, [db]),
  );

  function newRoutine() {
    Alert.prompt('New Routine', 'Give it a name, e.g. "Upper / Lower" or "Summer Cut".', async (name) => {
      if (!name?.trim()) return;
      const id = await addRoutine(db, name);
      router.push({ pathname: '/routine/[routineId]', params: { routineId: id } });
    });
  }

  return (
    <Page title="Plan Editor" footer={<Button title="+ New Routine" kind="secondary" onPress={newRoutine} />}>
      <AppText muted>
        A routine is a separate set of workouts with its own rotation. Only the active routine shows on Home. History
        keeps everything.
      </AppText>
      <Section title="Routines">
        {rows.map(({ routine, count, active }) => (
          <ListRow
            key={routine.id}
            title={routine.name}
            subtitle={`${count} ${count === 1 ? 'workout' : 'workouts'}`}
            onPress={() => router.push({ pathname: '/routine/[routineId]', params: { routineId: routine.id } })}
            right={
              active ? (
                <View style={{ backgroundColor: colors.accentSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
                  <AppText variant="small" color={colors.accent}>
                    Active
                  </AppText>
                </View>
              ) : undefined
            }
          />
        ))}
      </Section>
    </Page>
  );
}
