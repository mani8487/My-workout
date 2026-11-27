/** Finish Summary: shown right after finishing a workout. Calm, no forced rating or sharing. */
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { Milo } from '@/components/mascot';
import { PressableScale } from '@/components/pressable-scale';
import { PrPill } from '@/components/pr-pill';
import { getWorkouts } from '@/db/plan';
import { getSessionDetail } from '@/db/sessions';
import { formatDuration, formatKg } from '@/logic/format';
import { getSessionRecords, type PersonalRecord } from '@/logic/records';
import { getRotation } from '@/logic/rotation';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type Summary = {
  workoutName: string;
  muscleLabel: string;
  workingSets: number;
  /** Exercises with at least one ticked working set. */
  exercises: number;
  durationMin: number;
  records: PersonalRecord[];
  rotationLine: string;
};

export default function SummaryScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    (async () => {
      const detail = await getSessionDetail(db, Number(id));
      if (!detail) return;
      const [workouts, records, rotation] = await Promise.all([
        getWorkouts(db),
        getSessionRecords(db, detail.id),
        getRotation(db),
      ]);
      const workout = workouts.find((w) => w.id === detail.workoutId);
      const workingSets = detail.exercises
        .flatMap((e) => e.sets)
        .filter((s) => !s.isWarmup && s.completedAt != null).length;
      const exercises = detail.exercises.filter((e) => e.sets.some((s) => !s.isWarmup && s.completedAt != null)).length;
      const durationMin = Math.max(1, Math.round(((detail.finishedAt ?? Date.now()) - detail.startedAt) / 60000));
      const nextName = rotation.next?.name ?? '';
      const rotationLine =
        rotation.done.size === 0
          ? `Cycle complete! Next up: ${nextName}`
          : `${detail.workoutName} done. ${nextName} is next`;
      // One celebration per workout: a success haptic if there's a new record.
      if (records.length > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSummary({
        workoutName: detail.workoutName,
        muscleLabel: workout?.muscleLabel ?? '',
        workingSets,
        exercises,
        durationMin,
        records,
        rotationLine,
      });
    })();
  }, [db, id]);

  if (!summary) return <SkeletonScreen />;
  return <MistSummary summary={summary} />;
}

/** Milo celebrating, four glass tiles, and a Done pill. */
function MistSummary({ summary }: { summary: Summary }) {
  const { colors } = useTheme();
  const [showPrs, setShowPrs] = useState(false);
  const prCount = summary.records.length;
  // One line per exercise, even if it set both a weight and a reps record.
  const prExercises = [...new Set(summary.records.map((r) => r.exerciseName))];
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Milo state="celebrating" size={220} style={{ alignSelf: 'center', marginBottom: -spacing.lg }} />
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
            Workout complete
          </AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            {summary.workoutName}
            {summary.muscleLabel ? ` · ${summary.muscleLabel}` : ''}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MistTile label="Duration" value={formatDuration(summary.durationMin)} />
          <MistTile label="Exercises" value={String(summary.exercises)} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MistTile label="Sets" value={String(summary.workingSets)} />
          <MistTile
            label="Personal records"
            value={String(prCount)}
            hint={prCount > 0 ? (showPrs ? 'Hide' : 'Tap to see') : undefined}
            onPress={prCount > 0 ? () => setShowPrs((s) => !s) : undefined}
            expanded={showPrs}
          />
        </View>

        {showPrs && prCount > 0 && (
          <Animated.View entering={FadeInDown.duration(220)}>
            <GlassTile style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
              {prExercises.map((ex, i) => {
                const recs = summary.records.filter((r) => r.exerciseName === ex);
                return (
                  <View
                    key={ex}
                    accessible
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                    }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{ex}</AppText>
                      {recs.map((r) => (
                        <AppText key={r.kind} variant="small" muted>
                          {r.weightKg ? `${formatKg(r.weightKg)} kg` : 'Bodyweight'} × {r.reps}
                          {r.kind === 'weight' ? ` · was ${formatKg(r.previousBest)} kg` : ` · was ${r.previousBest} reps`}
                        </AppText>
                      ))}
                    </View>
                    <PrPill kind={recs[0].kind} />
                  </View>
                );
              })}
            </GlassTile>
          </Animated.View>
        )}

        <AppText variant="small" muted style={{ textAlign: 'center' }}>
          {summary.rotationLine}
        </AppText>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <PressableScale
          onPress={() => router.dismissTo('/')}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={{ minHeight: 52, borderRadius: 999, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="label" color={colors.onAccent}>
            Done
          </AppText>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

function MistTile({
  label,
  value,
  hint,
  onPress,
  expanded,
}: {
  label: string;
  value: string;
  hint?: string;
  onPress?: () => void;
  expanded?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <GlassTile style={{ borderRadius: radius.lg, padding: spacing.lg, gap: 2, minHeight: 104 }}>
      <AppText variant="small" muted numberOfLines={2}>
        {label}
      </AppText>
      <AppText variant="title" style={{ fontSize: 32 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {hint && (
        <AppText variant="small" color={colors.text} style={{ textDecorationLine: 'underline' }}>
          {hint}
        </AppText>
      )}
    </GlassTile>
  );
  if (!onPress) {
    return (
      <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Shows which exercises"
      accessibilityState={{ expanded }}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
      {body}
    </Pressable>
  );
}
