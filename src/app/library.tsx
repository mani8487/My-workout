/** Exercise Library: every built-in exercise plus your own. Tap + to add a custom one. */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Alert, Pressable, TextInput } from 'react-native';

import { ListRow, Section } from '@/components/list';
import { Page } from '@/components/page';
import { deleteCustomExercise, getAllExercises } from '@/db/plan';
import type { Exercise } from '@/db/types';
import { describeExercise } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');

  const refresh = useCallback(() => {
    getAllExercises(db).then(setAll);
  }, [db]);
  useFocusEffect(refresh);

  const query = q.trim().toLowerCase();
  const match = (e: Exercise) => !query || e.name.toLowerCase().includes(query) || e.muscles.some((m) => m.includes(query));
  const custom = all.filter((e) => e.isCustom && match(e));
  const builtIn = all.filter((e) => !e.isCustom && match(e));

  function confirmDelete(e: Exercise) {
    Alert.alert(`Delete ${e.name}?`, 'Past workouts that used it stay in History.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!(await deleteCustomExercise(db, e.id))) {
            Alert.alert('Still in your plan', `Remove ${e.name} from the Plan Editor first.`);
          }
          refresh();
        },
      },
    ]);
  }

  return (
    <Page title="Exercise Library" right={{ icon: 'plus', label: 'Add custom exercise', onPress: () => router.push('/exercise-new') }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search by name or muscle"
        placeholderTextColor={colors.textMuted}
        clearButtonMode="while-editing"
        style={{ ...typography.body, color: colors.text, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }}
      />
      {custom.length > 0 && (
        <Section title="Your exercises">
          {custom.map((e) => (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={describeExercise(e)}
              right={
                <Pressable onPress={() => confirmDelete(e)} hitSlop={8} accessibilityLabel={`Delete ${e.name}`}>
                  <SymbolView name="trash" size={18} tintColor={colors.danger} />
                </Pressable>
              }
            />
          ))}
        </Section>
      )}
      <Section title={`Built-in (${builtIn.length})`}>
        {builtIn.map((e) => (
          <ListRow key={e.id} title={e.name} subtitle={describeExercise(e)} />
        ))}
      </Section>
    </Page>
  );
}
