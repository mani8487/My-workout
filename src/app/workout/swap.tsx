/**
 * Swap Exercise sheet: suggests alternatives that hit the same muscles,
 * with the full library underneath. The swap is for today only.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { getSwapSuggestions } from '@/db/plan';
import { getSessionDetail, swapExercise } from '@/db/sessions';
import type { Exercise } from '@/db/types';
import { titleCase } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function SwapScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { sessionExerciseId } = useLocalSearchParams<{ sessionExerciseId: string }>();
  const seId = Number(sessionExerciseId);

  const [currentName, setCurrentName] = useState('');
  const [lists, setLists] = useState<{ suggested: Exercise[]; others: Exercise[] } | null>(null);
  const [search, setSearch] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  /** Working sets already ticked on the current exercise (they stay with it). */
  const [startedSets, setStartedSets] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const se = await db.getFirstAsync<{ session_id: number; exercise_id: string; exercise_name: string }>(
        'SELECT session_id, exercise_id, exercise_name FROM session_exercises WHERE id = ?',
        seId,
      );
      if (!se) return;
      setCurrentName(se.exercise_name);
      setSessionId(se.session_id);
      const detail = await getSessionDetail(db, se.session_id);
      const current = detail?.exercises.find((e) => e.id === seId);
      setStartedSets(current?.sets.filter((s) => !s.isWarmup && s.completedAt != null).length ?? 0);
      const inWorkout = detail?.exercises.map((e) => e.exerciseId) ?? [];
      setLists(await getSwapSuggestions(db, se.exercise_id, inWorkout));
    })();
  }, [db, seId]);

  async function choose(ex: Exercise) {
    if (busy) return; // guard against a double-tap
    setBusy(true);
    try {
      const nextId = await swapExercise(db, seId, ex.id);
      if (startedSets > 0 && nextId != null && sessionId != null) {
        // The new exercise was added after the original: open it straight away.
        const detail = await getSessionDetail(db, sessionId);
        const i = detail?.exercises.findIndex((e) => e.id === nextId) ?? -1;
        if (i >= 0) {
          router.navigate({ pathname: '/workout/active', params: { index: String(i), at: String(nextId) } });
          return;
        }
      }
      router.back();
    } catch {
      setBusy(false);
      Alert.alert("Couldn't swap", 'Nothing was changed. Try again.');
    }
  }

  const q = search.trim().toLowerCase();
  const filteredOthers = (lists?.others ?? []).filter((e) => !q || e.name.toLowerCase().includes(q));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Swap Exercise" onBack={() => router.back()} backIcon="xmark" backLabel="Close" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {startedSets > 0 ? (
          <AppText muted>
            Your {startedSets} logged {startedSets === 1 ? 'set stays' : 'sets stay'} as{' '}
            <AppText variant="label">{currentName}</AppText>. The sets still to do switch to the exercise you pick. Your plan
            stays the same.
          </AppText>
        ) : (
          <AppText muted>
            Replacing <AppText variant="label">{currentName}</AppText> for today only. Your plan stays the same.
          </AppText>
        )}

        {lists && lists.suggested.length > 0 && !q && (
          <Section title="Same muscles">
            {lists.suggested.map((e, i) => (
              <ExerciseRow key={e.id} exercise={e} first={i === 0} onPress={() => choose(e)} />
            ))}
          </Section>
        )}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search all exercises"
          placeholderTextColor={colors.textMuted}
          clearButtonMode="while-editing"
          style={{
            ...typography.body,
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        />

        <Section title={q ? 'Results' : 'All exercises'}>
          {filteredOthers.map((e, i) => (
            <ExerciseRow key={e.id} exercise={e} first={i === 0} onPress={() => choose(e)} />
          ))}
          {filteredOthers.length === 0 && (
            <AppText muted style={{ padding: spacing.lg }}>
              No matches.
            </AppText>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="small" muted style={{ fontWeight: '600' }}>
        {title.toUpperCase()}
      </AppText>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}>
        {children}
      </View>
    </View>
  );
}

function ExerciseRow({ exercise, first, onPress }: { exercise: Exercise; first: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: spacing.lg,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        backgroundColor: pressed ? colors.cardAlt : 'transparent',
      })}>
      <AppText variant="label">{exercise.name}</AppText>
      <AppText variant="small" muted>
        {exercise.muscles.map(titleCase).join(' · ')} · {exercise.equipment}
      </AppText>
    </Pressable>
  );
}
