/** Home cards for a selected day that isn't "start today's workout": done, rest, or nothing logged. */
import { format } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Hero, HeroChip, HeroOutlineButton, HeroTitle } from '@/components/hero';
import type { DaySummary } from '@/db/history';
import { formatDuration } from '@/logic/format';
import type { ScheduleDay } from '@/logic/schedule';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

/** A finished workout: name, Completed, duration, and sets / reps / kilos. Tap to open it. */
export function CompletedCard({ day, summary }: { day: ScheduleDay; summary: DaySummary }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(summary.sessionId) } })}
      accessibilityLabel={`${summary.workoutName}, completed. Open the full session`}>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="small" color={colors.onHeroMuted} style={{ flex: 1, letterSpacing: 0.5 }}>
            {(day.isToday ? 'TODAY' : format(day.date, 'EEEE d MMM')).toUpperCase()}
          </AppText>
          <HeroChip icon="checkmark">Completed</HeroChip>
        </View>
        <HeroTitle>{summary.workoutName}</HeroTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs }}>
          {summary.durationMin != null && <HeroChip icon="clock">{formatDuration(summary.durationMin)}</HeroChip>}
          <HeroChip icon="list.bullet">{`${summary.workingSets} sets`}</HeroChip>
          <HeroChip icon="repeat">{`${summary.totalReps} reps`}</HeroChip>
          <HeroChip icon="scalemass">{`${summary.volumeKg.toLocaleString()} kg`}</HeroChip>
        </View>
        {day.sessions.length > 1 && (
          <AppText variant="small" color={colors.onHeroMuted}>
            +{day.sessions.length - 1} more workout{day.sessions.length > 2 ? 's' : ''} this day · see History
          </AppText>
        )}
        <AppText variant="small" color={colors.onHeroMuted} style={{ marginTop: spacing.sm }}>
          Tap to see every set and note
        </AppText>
      </Hero>
    </Pressable>
  );
}

/** Rest day (past or future), or a past training day with nothing logged. */
export function EmptyDayCard({ day, onPlan }: { day: ScheduleDay; onPlan: () => void }) {
  const { colors } = useTheme();
  const missed = day.status === 'missed';
  return (
    <Hero>
      <AppText variant="small" color={colors.onHeroMuted} style={{ letterSpacing: 0.5 }}>
        {format(day.date, 'EEEE d MMM').toUpperCase()}
      </AppText>
      <HeroTitle>{day.isPast ? (missed ? 'No workout logged' : 'Rest day') : 'Rest day'}</HeroTitle>
      <AppText color={colors.onHeroMuted}>
        {day.isPast
          ? missed
            ? 'This was a planned training day. Forgot to log it?'
            : 'Nothing logged, and nothing was planned.'
          : 'Recovery counts too. Want to train this day instead?'}
      </AppText>
      <View style={{ marginTop: spacing.md }}>
        {day.isPast ? (
          <HeroOutlineButton
            title="Log a Workout for This Day"
            onPress={() => router.push({ pathname: '/log-workout', params: { date: day.key } })}
          />
        ) : (
          <HeroOutlineButton title="Plan a Workout" onPress={onPlan} />
        )}
      </View>
    </Hero>
  );
}
