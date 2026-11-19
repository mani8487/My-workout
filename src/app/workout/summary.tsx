/** Finish Summary: shown right after finishing a workout. Calm, no forced rating or sharing. */
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
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
  durationMin: number;
  records: PersonalRecord[];
  rotationLine: string;
};

export default function SummaryScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
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
        durationMin,
        records,
        rotationLine,
      });
    })();
  }, [db, id]);

  if (!summary) return <SkeletonScreen />;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingTop: spacing.xxl }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <SymbolView name="checkmark.circle.fill" size={64} tintColor={colors.success} />
          <AppText variant="title">Workout Complete</AppText>
          {summary.records.length > 0 && (
            <AppText variant="label" color={colors.accent}>
              Session done. New PR on {summary.records[0].exerciseName}!
            </AppText>
          )}
          <AppText variant="heading">{summary.workoutName}</AppText>
          <AppText muted>{summary.muscleLabel}</AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatCard label="Working sets" value={String(summary.workingSets)} />
          <StatCard label="Duration" value={formatDuration(summary.durationMin)} />
        </View>

        {summary.records.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="small" muted style={{ fontWeight: '600' }}>
              NEW PERSONAL RECORDS
            </AppText>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}>
              {summary.records.map((r, i) => (
                <View
                  key={`${r.exerciseName}-${r.kind}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{r.exerciseName}</AppText>
                    <AppText variant="small" muted>
                      {r.weightKg ? `${formatKg(r.weightKg)} kg` : 'Bodyweight'} × {r.reps}
                      {r.kind === 'weight'
                        ? ` · was ${formatKg(r.previousBest)} kg`
                        : ` · was ${r.previousBest} reps`}
                    </AppText>
                  </View>
                  <PrPill kind={r.kind} shimmer />
                </View>
              ))}
            </View>
          </View>
        )}

        <AppText muted style={{ textAlign: 'center' }}>
          {summary.rotationLine}
        </AppText>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Button title="Done" kind="secondary" onPress={() => router.dismissTo('/')} />
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.xs,
      }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="title" style={{ fontSize: 34 }}>
        {value}
      </AppText>
    </View>
  );
}
