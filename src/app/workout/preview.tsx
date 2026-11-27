/** Workout Preview: target muscles, exercise list with rep targets, estimated time, then Start. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiloPeek, PEEK_VISIBLE } from '@/components/scene/milo-peek';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { ScreenHeader } from '@/components/screen-header';
import { getAllExercises, getWorkouts, type PlannedExercise } from '@/db/plan';
import { getActiveMinutesBetween, getGroupsTrainedSince, getQuickLogsBetween } from '@/db/quick-log';
import { weekStartOf } from '@/logic/schedule';
import { suggestForWorkout, type Suggestion } from '@/logic/suggestions';
import { getActiveSessionId, startSession } from '@/db/sessions';
import type { Workout, WorkoutId } from '@/db/types';
import { titleCase } from '@/logic/format';
import { estimateMinutes, getWorkoutPreview } from '@/logic/today';
import { DURATION, EASE } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

/** Milo's size when he peeks up from the bottom of the preview. */
const PEEK_SIZE = 130;

export default function PreviewScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  // from=room: opened by the Living Home start move, so Milo followed and peeks up from the bottom.
  const { id, from } = useLocalSearchParams<{ id: WorkoutId; from?: string }>();
  const [data, setData] = useState<{ workout: Workout; plan: PlannedExercise[]; minutes: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  /** Set once you accept: the plan for this session only. */
  const [override, setOverride] = useState<PlannedExercise[] | null>(null);

  useEffect(() => {
    (async () => {
      const workout = (await getWorkouts(db)).find((w) => w.id === id);
      if (!workout) return;
      const { plan, minutes } = await getWorkoutPreview(db, workout.id);
      setData({ workout, plan, minutes });

      // Suggestions only when you've quick-logged something in the last 24 hours.
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [recentLogs, activeTodayMin, groupsThisWeek, library] = await Promise.all([
        getQuickLogsBetween(db, now - 24 * 3600_000, now + 1),
        getActiveMinutesBetween(db, todayStart.getTime(), now + 1),
        getGroupsTrainedSince(db, weekStartOf(new Date()).getTime()),
        getAllExercises(db),
      ]);
      setSuggestion(suggestForWorkout({ plan, recentLogs, activeTodayMin, groupsThisWeek, library }));
    })();
  }, [db, id]);

  async function start() {
    if (!data || starting) return; // guard against a double-tap
    setStarting(true);
    try {
      if ((await getActiveSessionId(db)) == null) {
        await startSession(db, data.workout.id, data.workout.name, undefined, override ?? undefined);
      }
      router.replace('/workout/active');
    } finally {
      setStarting(false);
    }
  }

  // A plain background while loading (no skeleton flashing through the fade-in), then the content fades in.
  if (!data) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const plan = override ?? data.plan;
  const minutes = override ? estimateMinutes(override) : data.minutes;
  const totalSets = plan.reduce((n, p) => n + p.targetSets, 0);
  const peek = from === 'room';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View entering={FadeIn.duration(DURATION.micro.slow).easing(EASE.out)} style={{ flex: 1 }}>
      <ScreenHeader title="Workout Preview" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: peek ? Math.round(PEEK_SIZE * PEEK_VISIBLE) + spacing.lg : spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <SymbolView name={data.workout.icon as SFSymbol} size={40} tintColor={colors.accent} />
          <View style={{ flex: 1 }}>
            <AppText variant="title">{data.workout.name}</AppText>
            <AppText muted>{data.workout.muscleLabel}</AppText>
          </View>
        </View>

        <AppText variant="label">
          {plan.length} exercises · {totalSets} sets · about {minutes} min
        </AppText>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
          {plan.map((p, i) => (
            <View
              key={`${p.planItemId}-${p.exercise.id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}>
              <AppText variant="label" muted style={{ width: 20 }}>
                {i + 1}
              </AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{p.exercise.name}</AppText>
                <AppText variant="small" muted>
                  {p.exercise.muscles.map(titleCase).join(' · ')}
                </AppText>
              </View>
              <AppText muted>
                {p.targetSets} × {p.repMin}–{p.repMax}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
        {/* Living Home: Milo followed you here and peeks up over the bottom bar. */}
        {peek && (
          <View pointerEvents="none" style={{ position: 'absolute', right: spacing.lg, top: -Math.round(PEEK_SIZE * PEEK_VISIBLE) }}>
            <MiloPeek size={PEEK_SIZE} />
          </View>
        )}
        {suggestion && !override && (
          <SuggestionBanner
            message={suggestion.message}
            onAccept={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setOverride(suggestion.apply(data.plan));
            }}
            onDismiss={() => setSuggestion(null)}
          />
        )}
        {override && (
          <AppText variant="small" muted style={{ textAlign: 'center' }}>
            Changed for today only. Your saved plan stays the same.
          </AppText>
        )}
        <Button title="Start Workout" size="large" onPress={start} />
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}

/** "You did 40 squats earlier. Swap Squats for Lunges?" with Accept / Dismiss. */
function SuggestionBanner({ message, onAccept, onDismiss }: { message: string; onAccept: () => void; onDismiss: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.accentSoft }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <SymbolView name="lightbulb" size={18} tintColor={colors.accent} />
        <AppText variant="body" style={{ flex: 1 }}>
          {message}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" style={{ justifyContent: 'center', paddingHorizontal: spacing.md, minHeight: 44 }}>
          <AppText variant="label" muted>
            Dismiss
          </AppText>
        </Pressable>
        <PressableScale
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel="Accept suggestion for today only"
          style={{ justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: 22, backgroundColor: colors.accent }}>
          <AppText variant="label" color={colors.onAccent}>
            Accept
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}
