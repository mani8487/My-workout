/**
 * Workout Progress: every exercise in today's workout with its set progress.
 * Tap a row to jump to it (handy when a machine is taken), tap the swap
 * icon to replace it for today, and finish the workout from here.
 */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import {
  cancelSession,
  getActiveSessionId,
  getSessionDetail,
  hasCompletedSets,
  type SessionDetail,
  type SessionExercise,
} from '@/db/sessions';
import { confirmFinishWorkout } from '@/logic/finish';
import { useRestTimer } from '@/logic/rest-timer';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

function counts(e: SessionExercise) {
  const working = e.sets.filter((s) => !s.isWarmup);
  return { done: working.filter((s) => s.completedAt != null).length, total: working.length };
}

export default function WorkoutOverviewScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const restTimer = useRestTimer();
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const id = await getActiveSessionId(db);
        if (id == null) {
          router.replace('/');
          return;
        }
        setDetail(await getSessionDetail(db, id));
      })();
    }, [db]),
  );

  if (!detail) return <SkeletonScreen />;

  const totals = detail.exercises.reduce(
    (acc, e) => {
      const c = counts(e);
      return { done: acc.done + c.done, total: acc.total + c.total };
    },
    { done: 0, total: 0 },
  );
  const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  const onFinishPress = () => confirmFinishWorkout(db, detail, restTimer.skip);

  async function onSwap(e: SessionExercise) {
    if (await hasCompletedSets(db, e.id)) {
      Alert.alert('Already started', `You've logged sets for ${e.name}, so it can't be swapped now.`);
      return;
    }
    router.push({ pathname: '/workout/swap', params: { sessionExerciseId: String(e.id) } });
  }

  function confirmCancel() {
    Alert.alert('Cancel this workout?', 'Everything logged in this workout will be deleted.', [
      { text: 'Keep Workout', style: 'cancel' },
      {
        text: 'Cancel Workout',
        style: 'destructive',
        onPress: async () => {
          restTimer.skip();
          await cancelSession(db, detail!.id);
          router.dismissTo('/');
        },
      },
    ]);
  }

  function openMenu() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel Workout', 'Close'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
        (i) => i === 0 && confirmCancel(),
      );
    } else confirmCancel();
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={detail.workoutName}
        onBack={() => router.dismissTo('/')}
        backLabel="Back to Home"
        right={{ icon: 'ellipsis.circle', label: 'Workout menu', onPress: openMenu }}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Overall progress */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="label">
              {totals.done} of {totals.total} sets
            </AppText>
            <AppText variant="label" muted>
              {pct}%
            </AppText>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        </View>

        {/* Exercise list */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
          {detail.exercises.map((e, i) => {
            const c = counts(e);
            const status = c.total > 0 && c.done >= c.total ? 'done' : c.done > 0 ? 'progress' : 'todo';
            return (
              <Pressable
                key={e.id}
                onPress={() => router.navigate({ pathname: '/workout/active', params: { index: String(i) } })}
                accessibilityLabel={`${e.name}, ${c.done} of ${c.total} sets. Tap to open`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                  backgroundColor: pressed ? colors.cardAlt : 'transparent',
                })}>
                <StatusCircle status={status} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{e.name}</AppText>
                  <AppText variant="small" muted>
                    {c.done}/{c.total} sets · {e.repMin}–{e.repMax} reps
                  </AppText>
                </View>
                <Pressable onPress={() => onSwap(e)} hitSlop={10} accessibilityLabel={`Swap ${e.name}`}>
                  <SymbolView name="arrow.triangle.2.circlepath" size={20} tintColor={colors.accent} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>

      </ScrollView>

      {/* Pinned to the bottom so it's always visible. */}
      <View
        style={{
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
        <Button title="Finish Workout" kind="secondary" onPress={onFinishPress} />
        <AppText variant="small" muted style={{ textAlign: 'center' }}>
          {totals.total} working sets planned
        </AppText>
      </View>
    </SafeAreaView>
  );
}

function StatusCircle({ status }: { status: 'done' | 'progress' | 'todo' }) {
  const { colors } = useTheme();
  if (status === 'done') {
    return (
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.success,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <SymbolView name="checkmark" size={13} weight="bold" tintColor={colors.background} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: status === 'progress' ? colors.accent : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {status === 'progress' && (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
      )}
    </View>
  );
}
