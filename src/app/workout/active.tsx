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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { LastTimeCards } from '@/components/last-time-cards';
import { ProgressRing } from '@/components/progress-ring';
import { RestTimerBar } from '@/components/rest-timer-bar';
import { closePad, NumberPad, usePadSpacer } from '@/components/number-pad';
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
  const { colors, name: themeName } = useTheme();
  // Ember gets the compact bottom bar and the orange current-set dot.
  const compact = themeName === 'ember';
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
  // Where you are in the workout: finished exercises plus the share of this one done.
  const exerciseFraction = (safeIndex + (workingTotal > 0 ? workingDone / workingTotal : 0)) / total;
  const currentSetId = exercise.sets.find((s) => s.completedAt == null)?.id;
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
                  isCurrent={compact && set.id === currentSetId}
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

          <Button
            title="Finish Workout"
            kind="secondary"
            onPress={() => confirmFinishWorkout(db, detail, restTimer.skip)}
          />        </ScrollView>
      </KeyboardAvoidingView>

      <RestTimerBar />

      {/* Previous / Next exercise */}
      {compact ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}>
          <PressableScale
            onPress={openOverview}
            pressedScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={`Exercise ${safeIndex + 1} of ${total}, ${exercise.name}. Open workout overview`}
            style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ProgressRing size={48} stroke={3} fraction={exerciseFraction}>
              <AppText variant="small" maxFontSizeMultiplier={1.1}>
                {safeIndex + 1}/{total}
              </AppText>
            </ProgressRing>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="label" numberOfLines={1}>
                {exercise.name}
              </AppText>
              <AppText variant="small" muted numberOfLines={1}>
                {nextExercise ? `Next: ${nextExercise.name}` : 'Last exercise'}
              </AppText>
            </View>
          </PressableScale>
          {prevExercise && (
            <PressableScale
              onPress={() => goTo(safeIndex - 1)}
              accessibilityRole="button"
              accessibilityLabel={`Previous exercise, ${prevExercise.name}`}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
            </PressableScale>
          )}
          <PressableScale
            onPress={() => (nextExercise ? goTo(safeIndex + 1) : openOverview())}
            accessibilityRole="button"
            accessibilityLabel={nextExercise ? `Next exercise, ${nextExercise.name}` : 'Overview and finish'}
            style={{
              height: 44,
              paddingHorizontal: spacing.lg + 2,
              borderRadius: 22,
              // Solid orange once this exercise is done: the obvious next move.
              backgroundColor: exerciseDone ? colors.accent : colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppText variant="label" color={exerciseDone ? colors.onAccent : colors.text}>
              {nextExercise ? 'Next' : 'Finish'}
            </AppText>
          </PressableScale>
        </View>
      ) : (
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
          highlight={exerciseDone}
          onPress={() => (nextExercise ? goTo(safeIndex + 1) : openOverview())}
        />
      </View>
      )}

      <NumberPad scrollRef={scrollRef} scrollY={scrollY} />
    </SafeAreaView>
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

function NavButton({
  direction,
  label,
  disabled,
  highlight = false,
  onPress,
}: {
  direction: 'prev' | 'next';
  label?: string;
  disabled: boolean;
  /** Solid accent fill: this exercise is done, so Next is the obvious move. */
  highlight?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const isNext = direction === 'next';
  const fg = highlight ? colors.onAccent : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={isNext ? 'Next exercise' : 'Previous exercise'}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: isNext ? 'flex-end' : 'flex-start',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: highlight ? colors.accent : colors.card,
        borderWidth: 1,
        borderColor: highlight ? colors.accent : colors.border,
        opacity: disabled ? 0.4 : 1,
      }}>
      {!isNext && <SymbolView name="chevron.left" size={14} tintColor={fg} />}
      <View style={{ flexShrink: 1, alignItems: isNext ? 'flex-end' : 'flex-start' }}>
        <AppText variant="small" muted={!highlight} color={highlight ? fg : undefined}>
          {isNext ? 'Next' : 'Previous'}
        </AppText>
        <AppText variant="label" numberOfLines={1} color={highlight ? fg : undefined}>
          {label ?? '—'}
        </AppText>
      </View>
      {isNext && <SymbolView name="chevron.right" size={14} tintColor={fg} />}
    </PressableScale>
  );
}
