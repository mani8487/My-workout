/**
 * Active Workout screen: logging sets for one exercise at a time.
 *
 * Built in Step 2. Still to come here:
 *  - Step 3: automatic rest timer (starts when you tick a set)
 *  - Step 4: "Last time" card and the green weight-suggestion card
 *  - Step 5: Swap Exercise and the Workout Progress overview
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { LastTimeCards } from '@/components/last-time-cards';
import { RestTimerBar } from '@/components/rest-timer-bar';
import { COLS, SET_INPUT_ACCESSORY_ID, SetRow } from '@/components/set-row';
import { confirmFinishWorkout } from '@/logic/finish';
import { useRestTimer } from '@/logic/rest-timer';
import {
  addSet,
  cancelSession,
  deleteSet,
  getActiveSessionId,
  getSessionDetail,
  hasCompletedSets,
  updateSet,
  type SessionDetail,
  type SessionExercise,
  type SetPatch,
} from '@/db/sessions';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

/** First exercise that still has unticked working sets (where you left off). */
function firstUnfinishedIndex(detail: SessionDetail) {
  const i = detail.exercises.findIndex((e) => e.sets.some((s) => !s.isWarmup && s.completedAt == null));
  return i === -1 ? 0 : i;
}

export default function ActiveWorkoutScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ index?: string }>();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [index, setIndex] = useState<number | null>(params.index != null ? Number(params.index) : null);
  const [rirForSetId, setRirForSetId] = useState<number | null>(null);
  const restTimer = useRestTimer();

  const refresh = useCallback(async () => {
    const id = await getActiveSessionId(db);
    if (id == null) {
      router.replace('/');
      return;
    }
    const d = await getSessionDetail(db, id);
    setDetail(d);
    if (d) setIndex((current) => current ?? firstUnfinishedIndex(d));
  }, [db]);

  // Reload whenever this screen comes back into view (e.g. after a swap).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Jump to an exercise when the Workout Progress screen sends us one.
  useEffect(() => {
    if (params.index != null) {
      setIndex(Number(params.index));
      setRirForSetId(null);
    }
  }, [params.index]);

  if (!detail || index == null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const total = detail.exercises.length;
  const safeIndex = Math.min(Math.max(index, 0), total - 1);
  const exercise: SessionExercise | undefined = detail.exercises[safeIndex];

  async function save(setId: number, patch: SetPatch) {
    await updateSet(db, setId, patch);
    await refresh();
  }

  function openOverview() {
    Keyboard.dismiss();
    router.navigate('/workout/overview');
  }

  async function openSwap() {
    if (!exercise) return;
    if (await hasCompletedSets(db, exercise.id)) {
      Alert.alert('Already started', `You've logged sets for ${exercise.name}, so it can't be swapped now.`);
      return;
    }
    router.push({ pathname: '/workout/swap', params: { sessionExerciseId: String(exercise.id) } });
  }

  function goTo(i: number) {
    Keyboard.dismiss();
    setRirForSetId(null);
    setIndex(i);
  }

  function confirmCancel() {
    Alert.alert(
      'Cancel this workout?',
      'Everything logged in this workout will be deleted. Use this for a workout started by accident.',
      [
        { text: 'Keep Workout', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: async () => {
            restTimer.skip();
            await cancelSession(db, detail!.id);
            router.replace('/');
          },
        },
      ],
    );
  }

  function openMenu() {
    Keyboard.dismiss();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Swap Exercise', 'Workout Overview', 'Cancel Workout', 'Close'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (i) => {
          if (i === 0) openSwap();
          if (i === 1) openOverview();
          if (i === 2) confirmCancel();
        },
      );
    } else {
      Alert.alert('Workout', undefined, [
        { text: 'Swap Exercise', onPress: openSwap },
        { text: 'Workout Overview', onPress: openOverview },
        { text: 'Cancel Workout', style: 'destructive', onPress: confirmCancel },
        { text: 'Close', style: 'cancel' },
      ]);
    }
  }

  if (!exercise) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.lg }}>
        <AppText variant="heading">This workout has no exercises.</AppText>
        <Button title="Cancel Workout" kind="secondary" onPress={confirmCancel} />
      </SafeAreaView>
    );
  }

  // Number the working sets 1, 2, 3… and show warm-ups as "W".
  const prevWorking = exercise.previous.filter((p) => !p.isWarmup);
  const prevWarmup = exercise.previous.filter((p) => p.isWarmup);
  let workingNo = 0;
  let warmupNo = 0;
  const rows = exercise.sets.map((s) => {
    if (s.isWarmup) {
      const prev = prevWarmup[warmupNo++];
      return { set: s, label: 'W', previous: prev };
    }
    const prev = prevWorking[workingNo];
    workingNo += 1;
    return { set: s, label: String(workingNo), previous: prev };
  });

  const workingDone = exercise.sets.filter((s) => !s.isWarmup && s.completedAt != null).length;
  const workingTotal = exercise.sets.filter((s) => !s.isWarmup).length;
  const prevExercise = detail.exercises[safeIndex - 1];
  const nextExercise = detail.exercises[safeIndex + 1];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header: back, exercise name, menu */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 48 }}>
        <Pressable onPress={openOverview} hitSlop={10} accessibilityLabel="Workout overview" style={{ width: 44, alignItems: 'center' }}>
          <SymbolView name="chevron.left" size={22} tintColor={colors.accent} />
        </Pressable>
        <AppText variant="heading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {exercise.name}
        </AppText>
        <Pressable onPress={openMenu} hitSlop={10} accessibilityLabel="Workout menu" style={{ width: 44, alignItems: 'center' }}>
          <SymbolView name="ellipsis.circle" size={22} tintColor={colors.accent} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
          {/* Progress through the workout */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="small" muted>
                {detail.workoutName} · Exercise {safeIndex + 1} of {total}
              </AppText>
              <AppText variant="small" muted>
                {workingDone}/{workingTotal} sets
              </AppText>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${((safeIndex + 1) / total) * 100}%`,
                  height: '100%',
                  backgroundColor: colors.accent,
                }}
              />
            </View>
            <AppText variant="label">
              Target: {exercise.targetSets} sets of {exercise.repMin}–{exercise.repMax} reps
            </AppText>
          </View>

          <LastTimeCards exercise={exercise} />

          {/* Set table */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}>
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
              <HeaderCell width={COLS.set} text="SET" />
              <View style={{ flex: 1 }}>
                <AppText variant="small" muted style={{ fontWeight: '600' }}>
                  PREVIOUS
                </AppText>
              </View>
              <HeaderCell width={COLS.kg} text="KG" />
              <HeaderCell width={COLS.reps} text="REPS" />
              <View style={{ width: COLS.tick }} />
              <View style={{ width: COLS.note }} />
            </View>

            {rows.map(({ set, label, previous }, i) => (
              <View key={set.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                <SetRow
                  set={set}
                  label={label}
                  previous={previous}
                  showRir={rirForSetId === set.id}
                  onSave={(patch) => save(set.id, patch)}
                  onCompleted={() => {
                    setRirForSetId(set.id);
                    // Rest starts by itself. Warm-ups get a shorter 60 s rest.
                    restTimer.start(set.isWarmup ? 60 : exercise.restSeconds);
                  }}
                  onRir={async (rir) => {
                    setRirForSetId(null);
                    if (rir != null) await save(set.id, { rir });
                  }}
                  onDelete={async () => {
                    await deleteSet(db, set.id);
                    await refresh();
                  }}
                />
              </View>
            ))}

            {rows.length === 0 && (
              <AppText muted style={{ padding: spacing.lg, textAlign: 'center' }}>
                No sets. Tap Add Set.
              </AppText>
            )}
          </View>

          <Button
            title="+ Add Set"
            kind="secondary"
            onPress={async () => {
              await addSet(db, exercise.id);
              await refresh();
            }}
          />

          <AppText variant="small" muted style={{ textAlign: 'center' }}>
            Long-press a set number for warm-up · Swipe a set left to delete · Tap a ticked set to edit
          </AppText>

          <Button
            title="Finish Workout"
            kind="secondary"
            onPress={() => confirmFinishWorkout(db, detail, restTimer.skip)}
          />        </ScrollView>
      </KeyboardAvoidingView>

      <RestTimerBar />

      {/* Previous / Next exercise */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}>
        <NavButton
          direction="prev"
          label={prevExercise?.name}
          disabled={!prevExercise}
          onPress={() => goTo(safeIndex - 1)}
        />
        <NavButton
          direction="next"
          label={nextExercise?.name ?? 'Overview & Finish'}
          disabled={false}
          onPress={() => (nextExercise ? goTo(safeIndex + 1) : openOverview())}
        />
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={SET_INPUT_ACCESSORY_ID}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: colors.cardAlt,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10}>
              <AppText variant="label" color={colors.accent}>
                Done
              </AppText>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </SafeAreaView>
  );
}

function HeaderCell({ width, text }: { width: number; text: string }) {
  return (
    <View style={{ width, alignItems: 'center' }}>
      <AppText variant="small" muted style={{ fontWeight: '600' }}>
        {text}
      </AppText>
    </View>
  );
}

function NavButton({
  direction,
  label,
  disabled,
  onPress,
}: {
  direction: 'prev' | 'next';
  label?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const isNext = direction === 'next';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={isNext ? 'Next exercise' : 'Previous exercise'}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: isNext ? 'flex-end' : 'flex-start',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}>
      {!isNext && <SymbolView name="chevron.left" size={14} tintColor={colors.text} />}
      <View style={{ flexShrink: 1, alignItems: isNext ? 'flex-end' : 'flex-start' }}>
        <AppText variant="small" muted>
          {isNext ? 'Next' : 'Previous'}
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {label ?? '—'}
        </AppText>
      </View>
      {isNext && <SymbolView name="chevron.right" size={14} tintColor={colors.text} />}
    </Pressable>
  );
}
