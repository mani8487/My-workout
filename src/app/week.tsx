/**
 * Week Schedule: one card per day, Monday to Sunday, with the workout, its
 * muscles, time, exercise count and a status badge. Cards stagger in one
 * after another; today's card is highlighted. Arrows change the week.
 *
 * Tapping a day: a finished workout opens its full session; today's planned
 * workout opens its preview; any other day goes back to Home with that day
 * selected (so Start stays locked until the day itself).
 */
import { addDays, addWeeks, format, isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Backdrop } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { getWorkouts } from '@/db/plan';
import type { Workout } from '@/db/types';
import { formatDuration } from '@/logic/format';
import { getWeekSchedule, parseDateKey, weekStartOf, type ScheduleDay } from '@/logic/schedule';
import { getWorkoutPreview } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

type Row = {
  day: ScheduleDay;
  title: string;
  muscles: string;
  meta: string;
  badge: 'Done' | 'Today' | 'Upcoming' | 'Rest' | 'Missed';
};

export default function WeekScheduleScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ start?: string }>();
  const [weekStart, setWeekStart] = useState(() =>
    params.start ? weekStartOf(parseDateKey(params.start)) : weekStartOf(new Date()),
  );
  const [rows, setRows] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [days, workouts] = await Promise.all([getWeekSchedule(db, weekStart), getWorkouts(db)]);
        const byId = new Map<string, Workout>(workouts.map((w) => [w.id, w]));
        const out: Row[] = [];
        for (const day of days) {
          const done = day.sessions[day.sessions.length - 1];
          if (done) {
            out.push({
              day,
              title: done.workoutName,
              muscles: byId.get(done.workoutId)?.muscleLabel ?? '',
              meta: [done.durationMin != null ? formatDuration(done.durationMin) : null, `${done.exercises} exercises`]
                .filter(Boolean)
                .join(' · '),
              badge: 'Done',
            });
          } else if (day.planned) {
            const p = await getWorkoutPreview(db, day.planned.id);
            out.push({
              day,
              title: day.planned.name,
              muscles: day.planned.muscleLabel,
              meta: `about ${p.minutes} min · ${p.plan.length} exercises`,
              badge: day.isToday ? 'Today' : 'Upcoming',
            });
          } else {
            out.push({
              day,
              title: day.status === 'missed' ? 'No workout logged' : 'Rest day',
              muscles: '',
              meta: day.status === 'missed' ? 'Planned training day' : 'Recovery',
              badge: day.status === 'missed' ? 'Missed' : day.isToday ? 'Today' : 'Rest',
            });
          }
        }
        setRows(out);
      })();
    }, [db, weekStart]),
  );

  function changeWeek(delta: -1 | 1) {
    Haptics.selectionAsync().catch(() => {});
    setRows(null); // clear first so the new week's cards stagger in fresh
    setWeekStart((w) => addWeeks(w, delta));
  }

  function open(row: Row) {
    Haptics.selectionAsync().catch(() => {});
    const done = row.day.sessions[row.day.sessions.length - 1];
    if (done) {
      router.push({ pathname: '/session/[id]', params: { id: String(done.sessionId) } });
    } else if (row.day.isToday && row.day.planned) {
      router.push({ pathname: '/workout/preview', params: { id: row.day.planned.id } });
    } else {
      router.navigate({ pathname: '/', params: { date: row.day.key } });
    }
  }

  const isThisWeek = isSameDay(weekStart, weekStartOf(new Date()));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <ScreenHeader title="Week Schedule" onBack={() => router.back()} backIcon="xmark" backLabel="Close" />

      {/* Week switcher */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <ArrowButton icon="chevron.left" label="Previous week" onPress={() => changeWeek(-1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="label">
            {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM')}
          </AppText>
          <AppText variant="small" muted>
            {isThisWeek ? 'This week' : format(weekStart, 'yyyy')}
          </AppText>
        </View>
        <ArrowButton icon="chevron.right" label="Next week" onPress={() => changeWeek(1)} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
        {rows?.map((row, i) => {
          const today = row.day.isToday;
          return (
            <Animated.View key={`${row.day.key}`} entering={FadeInDown.delay(i * 60).duration(240).springify().damping(18)}>
              <Pressable
                onPress={() => open(row)}
                accessibilityLabel={`${format(row.day.date, 'EEEE d MMMM')}: ${row.title}, ${row.badge}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.lg,
                  minHeight: 76,
                  borderRadius: radius.lg,
                  borderWidth: today ? 2 : 1,
                  borderColor: today ? colors.accent : colors.border,
                  backgroundColor: pressed ? colors.cardAlt : today ? colors.accentSoft : colors.card,
                })}>
                {/* Date */}
                <View style={{ width: 44, alignItems: 'center' }}>
                  <AppText variant="small" muted>
                    {format(row.day.date, 'EEE')}
                  </AppText>
                  <AppText variant="heading">{format(row.day.date, 'd')}</AppText>
                </View>

                {/* Workout */}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label" numberOfLines={1}>
                    {row.title}
                  </AppText>
                  {row.muscles ? (
                    <AppText variant="small" muted numberOfLines={1}>
                      {row.muscles}
                    </AppText>
                  ) : null}
                  <AppText variant="small" muted numberOfLines={1}>
                    {row.meta}
                  </AppText>
                </View>

                <StatusBadge badge={row.badge} />
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ badge }: { badge: Row['badge'] }) {
  const { colors } = useTheme();
  const style = {
    Done: { bg: colors.successSoft, fg: colors.success },
    Today: { bg: colors.accent, fg: colors.onAccent },
    Upcoming: { bg: colors.accentSoft, fg: colors.text },
    Rest: { bg: 'transparent', fg: colors.textMuted },
    Missed: { bg: colors.dangerSoft, fg: colors.danger },
  }[badge];
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 1,
        borderRadius: 999,
        backgroundColor: style.bg,
        borderWidth: badge === 'Rest' ? 1 : 0,
        borderColor: colors.border,
      }}>
      <AppText variant="small" color={style.fg}>
        {badge}
      </AppText>
    </View>
  );
}

function ArrowButton({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: MIN_TAP,
        height: MIN_TAP,
        borderRadius: MIN_TAP / 2,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      <SymbolView name={icon} size={16} tintColor={colors.text} />
    </Pressable>
  );
}
