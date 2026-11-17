/** Pick an exercise from the library to add to a workout's plan. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';

import { ListRow, Section } from '@/components/list';
import { Page } from '@/components/page';
import { addPlanItem, getAllExercises, getPlanForWorkout } from '@/db/plan';
import type { Exercise, WorkoutId } from '@/db/types';
import { describeExercise } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function AddToPlanScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { workoutId } = useLocalSearchParams<{ workoutId: WorkoutId }>();
  const [list, setList] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const inPlan = new Set((await getPlanForWorkout(db, workoutId)).map((p) => p.exercise.id));
      setList((await getAllExercises(db)).filter((e) => !inPlan.has(e.id)));
    })();
  }, [db, workoutId]);

  const query = q.trim().toLowerCase();
  const shown = list.filter((e) => !query || e.name.toLowerCase().includes(query) || e.muscles.some((m) => m.includes(query)));

  return (
    <Page title="Add Exercise" modal>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search by name or muscle"
        placeholderTextColor={colors.textMuted}
        clearButtonMode="while-editing"
        style={{ ...typography.body, color: colors.text, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }}
      />
      <Section>
        {shown.map((e) => (
          <ListRow
            key={e.id}
            title={e.name}
            subtitle={describeExercise(e)}
            chevron={false}
            onPress={async () => {
              await addPlanItem(db, workoutId, e.id);
              router.back();
            }}
          />
        ))}
      </Section>
    </Page>
  );
}
