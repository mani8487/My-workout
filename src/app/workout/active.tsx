/**
 * Active Workout screen: logging sets for one exercise at a time.
 *
 * Also shows the "Last time" and suggestion cards, and the rest timer
 * (which starts by itself when you tick a set).
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassTile } from '@/components/glass-tile';
import { GlassToast } from '@/components/glass-toast';
import { Milo, useMiloState } from '@/components/mascot';
import { MistWorkoutBar } from '@/components/mist-workout-bar';
import { PressableScale } from '@/components/pressable-scale';
import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { LastTimeCards } from '@/components/last-time-cards';
import { closePad, NumberPad, useActivePadId, usePadSpacer } from '@/components/number-pad';
import { COLS, SetRow } from '@/components/set-row';
import { confirmFinishWorkout } from '@/logic/finish';
import { confirmSplitSwap } from '@/logic/swap';
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
import { getSetting, setSetting } from '@/db/settings';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, TIGHT_FONT_SCALE } from '@/theme/typography';

const TIP_KEY = 'tip.setMenuSeen';

/** First exercise that still has unticked working sets (where you left off). */
function firstUnfinishedIndex(detail: SessionDetail) {
  const i = detail.exercises.findIndex((e) => e.sets.some((s) => !s.isWarmup && s.completedAt == null));
  return i === -1 ? 0 : i;
}

export default function ActiveWorkoutScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const milo = useMiloState('sitting');
  const [savedSignal, setSavedSignal] = useState(0);
  const { height: screenH } = useWindowDimensions();
  const padOpen = useActivePadId() != null;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  // `at` changes on every jump, so jumping to the same index twice still works.
  const params = useLocalSearchParams<{ index?: string; at?: string }>();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [index, setIndex] = useState<number | null>(params.index != null ? Number(params.index) : null);
  const [rirForSetId, setRirForSetId] = useState<number | null>(null);
  const restTimer = useRestTimer();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const padSpacer = usePadSpacer();
  // One-time tip about the set-number menu; hidden for good once dismissed.
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    getSetting(db, TIP_KEY).then((v) => setShowTip(v == null)).catch(() => {});
  }, [db]);
  function dismissTip() {
    setShowTip(false);
    setSetting(db, TIP_KEY, '1').catch(() => {});
  }

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
      // Deliberate: follow the exercise chosen on the Workout Progress screen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(Number(params.index));
      setRirForSetId(null);
    }
  }, [params.index, params.at]);

  if (!detail || index == null) {
    return <SkeletonScreen />;
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
    closePad();
    router.navigate('/workout/overview');
  }

  async function openSwap() {
    if (!exercise) return;
    const go = () => router.push({ pathname: '/workout/swap', params: { sessionExerciseId: String(exercise.id) } });
    if (await hasCompletedSets(db, exercise.id)) confirmSplitSwap(exercise.name, go);
    else go();
  }

  function goTo(i: number) {
    Keyboard.dismiss();
    closePad();
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
    closePad();
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
  const rows = exercise.sets.map((s, i) => {
    const before = exercise.sets.slice(0, i);
    if (s.isWarmup) {
      return { set: s, label: 'W', previous: prevWarmup[before.filter((x) => x.isWarmup).length] };
    }
    const n = before.filter((x) => !x.isWarmup).length;
    return { set: s, label: String(n + 1), previous: prevWorking[n] };
  });

  const workingDone = exercise.sets.filter((s) => !s.isWarmup && s.completedAt != null).length;
  const workingTotal = exercise.sets.filter((s) => !s.isWarmup).length;
  const exerciseDone = workingTotal > 0 && workingDone === workingTotal;
  // Whole-workout progress, by working sets ticked (not by exercise position).
  const allWorking = detail.exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  const allDone = allWorking.filter((s) => s.completedAt != null).length;
  const progress = allWorking.length > 0 ? allDone / allWorking.length : 0;
  const prevExercise = detail.exercises[safeIndex - 1];
  const nextExercise = detail.exercises[safeIndex + 1];
  async function addOneSet() {
    if (!exercise) return;
    await addSet(db, exercise.id);
    await refresh();
  }

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
        <Pressable
          onPress={() => confirmFinishWorkout(db, detail, restTimer.skip, true)}
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          style={{ minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center' }}>
          <AppText variant="label" color={colors.accent}>
            Finish
          </AppText>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl + padSpacer }}>
          {/* Progress through the workout */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="small" muted>
                {detail.workoutName} · Exercise {safeIndex + 1} of {total}
              </AppText>
              <AppText variant="small" muted>
                {allDone}/{allWorking.length} sets done
              </AppText>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${progress * 100}%`,
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
          <GlassTile style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
              <HeaderCell width={COLS.set} text="SET" />
              <View style={{ flex: 1 }}>
                <AppText variant="small" muted maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={{ fontWeight: '600' }}>
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
                    setSavedSignal((n) => n + 1);
                    milo.react();
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
                No sets. Tap + Set.
              </AppText>
            )}
          </GlassTile>

          <MistExerciseNav
            prevName={prevExercise?.name}
            nextName={nextExercise?.name}
            done={exerciseDone}
            onPrev={() => goTo(safeIndex - 1)}
            onNext={() => (nextExercise ? goTo(safeIndex + 1) : openOverview())}
          />
          {/* Milo keeps you company below the table; out of the way while typing or with a long table. */}
          {!padOpen && !keyboardOpen && (
            <Milo
              {...milo.props}
              size={Math.round(screenH * 0.15 * (rows.length > 5 ? 0.6 : 1))}
              style={{ alignSelf: 'center' }}
            />
          )}

          {showTip && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.accentSoft,
              }}>
              <SymbolView name="lightbulb" size={18} tintColor={colors.text} />
              <AppText variant="small" style={{ flex: 1 }}>
                Tip: tap a set number to mark a warm-up or delete it. Tap a ticked set&apos;s numbers to edit them.
              </AppText>
              <Pressable onPress={dismissTip} hitSlop={12} accessibilityLabel="Dismiss tip">
                <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
              </Pressable>
            </View>
          )}

        </ScrollView>
        <GlassToast signal={savedSignal} message="Set saved" />
      </KeyboardAvoidingView>

      <MistWorkoutBar restSeconds={exercise.restSeconds} onAddSet={addOneSet} />

      <NumberPad scrollRef={scrollRef} scrollY={scrollY} />
    </SafeAreaView>
  );
}

/** Mist: previous / next exercise under the table. Next turns solid once this exercise is done. */
function MistExerciseNav({
  prevName,
  nextName,
  done,
  onPrev,
  onNext,
}: {
  prevName?: string;
  nextName?: string;
  done: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <PressableScale
        onPress={onPrev}
        disabled={!prevName}
        accessibilityRole="button"
        accessibilityLabel={prevName ? `Previous exercise, ${prevName}` : 'No previous exercise'}
        style={{ opacity: prevName ? 1 : 0.35 }}>
        <GlassTile style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </GlassTile>
      </PressableScale>
      <PressableScale
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={nextName ? `Next exercise, ${nextName}` : 'Workout overview'}
        style={{ flex: 1 }}>
        {done ? (
          <View style={{ minHeight: 44, borderRadius: 22, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg }}>
            <AppText variant="label" color={colors.onAccent} numberOfLines={1} style={{ flexShrink: 1 }}>
              {nextName ? `Next: ${nextName}` : 'Workout overview'}
            </AppText>
            <SymbolView name="chevron.right" size={14} tintColor={colors.onAccent} />
          </View>
        ) : (
          <GlassTile style={{ minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg }}>
            <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {nextName ? `Next: ${nextName}` : 'Workout overview'}
            </AppText>
            <SymbolView name="chevron.right" size={14} tintColor={colors.text} />
          </GlassTile>
        )}
      </PressableScale>
    </View>
  );
}

function HeaderCell({ width, text }: { width: number; text: string }) {
  return (
    <View style={{ width, alignItems: 'center' }}>
      <AppText variant="small" muted maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={{ fontWeight: '600' }}>
        {text}
      </AppText>
    </View>
  );
}
