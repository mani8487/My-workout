/**
 * Home tab. Still mostly a placeholder: the real Home screen (greeting,
 * rotation, today's owed workout, Change Workout) is built in Step 7.
 *
 * Step 2: Start Workout now really starts a workout (always Push for now),
 * or says "Resume Workout" if one is already in progress.
 */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { getPlanForWorkout, getWorkouts } from '@/db/plan';
import { getActiveSessionId, getSessionDetail, startSession } from '@/db/sessions';
import type { Workout } from '@/db/types';
import { useTheme } from '@/theme/theme-context';

type Today = { workout: Workout; exerciseCount: number };

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [today, setToday] = useState<Today | null>(null);
  const [active, setActive] = useState<{ name: string; setsDone: number } | null>(null);

  // Reload every time Home comes back into view (e.g. after a workout).
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const workouts = await getWorkouts(db);
        const push = workouts.find((w) => w.id === 'push') ?? workouts[0];
        if (push) {
          const plan = await getPlanForWorkout(db, push.id);
          setToday({ workout: push, exerciseCount: plan.length });
        }
        const activeId = await getActiveSessionId(db);
        if (activeId != null) {
          const d = await getSessionDetail(db, activeId);
          const setsDone = d?.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt != null && !s.isWarmup).length ?? 0;
          setActive(d ? { name: d.workoutName, setsDone } : null);
        } else {
          setActive(null);
        }
      })();
    }, [db]),
  );

  const [starting, setStarting] = useState(false);

  async function onStart() {
    if (active) {
      router.push('/workout/active');
      return;
    }
    if (!today || starting) return; // guard against a double-tap starting two workouts
    setStarting(true);
    try {
      await startSession(db, today.workout.id, today.workout.name);
      router.push('/workout/active');
    } finally {
      setStarting(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">Hello</AppText>

      {active ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <AppText variant="small" muted>
            IN PROGRESS
          </AppText>
          <AppText variant="heading">{active.name}</AppText>
          <AppText muted>
            {active.setsDone} {active.setsDone === 1 ? 'set' : 'sets'} logged so far
          </AppText>
        </Card>
      ) : (
        today && (
          <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
            <AppText variant="small" muted>
              TODAY&apos;S WORKOUT
            </AppText>
            <AppText variant="heading">{today.workout.name}</AppText>
            <AppText muted>
              {today.workout.muscleLabel} · {today.exerciseCount} exercises
            </AppText>
          </Card>
        )
      )}

      <Button title={active ? 'Resume Workout' : 'Start Workout'} size="large" onPress={onStart} />
      <Button
        title="Change Workout"
        kind="secondary"
        onPress={() => Alert.alert('Coming soon', 'Change Workout and the rotation arrive in Step 7.')}
      />
    </Screen>
  );
}
