/**
 * One past workout in full: every exercise and set with weight, reps,
 * reps in reserve and notes. Sets can be edited (tap the numbers), added,
 * swiped away, and the whole session can be deleted.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { NumberPadBar, SetRow } from '@/components/set-row';
import { addSet, cancelSession, deleteSet, getSessionDetail, updateSet, type SessionDetail } from '@/db/sessions';
import { formatDuration } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function SessionDetailScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [rirForSetId, setRirForSetId] = useState<number | null>(null);

  const refresh = useCallback(async () => setDetail(await getSessionDetail(db, Number(id))), [db, id]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!detail) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const workingSets = detail.exercises.flatMap((e) => e.sets).filter((s) => !s.isWarmup && s.completedAt != null).length;
  const minutes = detail.finishedAt ? Math.max(1, Math.round((detail.finishedAt - detail.startedAt) / 60000)) : null;

  function confirmDelete() {
    Alert.alert('Delete this workout?', 'All its sets and notes will be removed. This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelSession(db, detail!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={detail.workoutName} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
          <AppText muted style={{ textAlign: 'center' }}>
            {new Date(detail.startedAt).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {'\n'}
            {workingSets} working sets{minutes ? ` · ${formatDuration(minutes)}` : ''}
          </AppText>

          {detail.exercises.map((e) => {
            let n = 0;
            return (
              <View key={e.id} style={{ gap: spacing.sm }}>
                <AppText variant="label">{e.name}</AppText>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                  }}>
                  {e.sets.map((s, i) => (
                    <View key={s.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                      <SetRow
                        set={s}
                        label={s.isWarmup ? 'W' : String(++n)}
                        hidePrevious
                        showRir={rirForSetId === s.id}
                        onSave={async (patch) => {
                          await updateSet(db, s.id, patch);
                          await refresh();
                        }}
                        onCompleted={() => setRirForSetId(s.id)}
                        onRir={async (rir) => {
                          setRirForSetId(null);
                          if (rir != null) {
                            await updateSet(db, s.id, { rir });
                            await refresh();
                          }
                        }}
                        onDelete={async () => {
                          await deleteSet(db, s.id);
                          await refresh();
                        }}
                      />
                    </View>
                  ))}
                  <Pressable
                    onPress={async () => {
                      await addSet(db, e.id);
                      await refresh();
                    }}
                    style={{
                      padding: spacing.md,
                      alignItems: 'center',
                      borderTopWidth: e.sets.length ? 1 : 0,
                      borderTopColor: colors.border,
                    }}>
                    <AppText variant="small" color={colors.accent} style={{ fontWeight: '600' }}>
                      + Add Set
                    </AppText>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <AppText variant="small" muted style={{ textAlign: 'center' }}>
            Tap a set&apos;s numbers to edit · Enter numbers and tick to log · Swipe left to delete
          </AppText>

          <Pressable onPress={confirmDelete} style={{ padding: spacing.md, alignItems: 'center' }}>
            <AppText variant="label" color={colors.danger}>
              Delete Workout
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <NumberPadBar />
    </SafeAreaView>
  );
}