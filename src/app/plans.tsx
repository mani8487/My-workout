/** Plan Editor: pick which of the five workouts to edit. */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';

import { AppText } from '@/components/app-text';
import { ListRow, Section } from '@/components/list';
import { Page } from '@/components/page';
import { getPlanForWorkout, getWorkouts } from '@/db/plan';
import type { Workout } from '@/db/types';

export default function PlanListScreen() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<{ workout: Workout; count: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const ws = await getWorkouts(db);
        setRows(await Promise.all(ws.map(async (w) => ({ workout: w, count: (await getPlanForWorkout(db, w.id)).length }))));
      })();
    }, [db]),
  );

  return (
    <Page title="Plan Editor">
      <AppText muted>Changes apply to future workouts. Past workouts in History never change.</AppText>
      <Section>
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
    </Page>
  );
}
