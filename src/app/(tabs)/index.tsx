/**
 * Home: greeting, the Mon–Sun strip (tap a day, swipe for other weeks), a card
 * for the selected day, and a scroller of your plans.
 *
 * The card follows the selected day:
 *  - Today: today's workout (Start / Change), or Resume if one is in progress,
 *    or what you did if you've already trained today.
 *  - A past day: what you logged (tap to open it), or "No workout logged" / "Rest day".
 *  - A future day: the planned workout (Start only works on the day itself),
 *    or "Rest day". Change Workout lets you reschedule that day.
 */
import { addWeeks, format, isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CompletedCard, EmptyDayCard } from '@/components/day-cards';
import { Hero, HeroButton, HeroChip, HeroOutlineButton, HeroTitle } from '@/components/hero';
import { Screen } from '@/components/screen';
import { WeekStrip } from '@/components/week-strip';
import { quoteOfTheDay } from '@/data/quotes';
import { getActiveSessionId, getSessionDetail } from '@/db/sessions';
import { getSetting } from '@/db/settings';
import type { Workout } from '@/db/types';
import { acceptFreshStart, dismissFreshStart, freshStartOffer } from '@/logic/fresh-start';
import type { Rotation } from '@/logic/rotation';
import { dateKey, getWeekSchedule, parseDateKey, weekStartOf, type ScheduleDay } from '@/logic/schedule';
import { getRoutineCards, getToday, getWorkoutPreview, greeting, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type HomeData = {
  name: string | null;
  rotation: Rotation;
  /** Today's workout. Null only when the active plan has no workouts yet. */
  workout: Workout | null;
  active: { name: string; setsDone: number } | null;
  plans: Awaited<ReturnType<typeof getRoutineCards>>;
  days: ScheduleDay[];
  /** Minutes / exercise count for each planned workout this week, by workout id. */
  previews: Record<string, { minutes: number; exercises: number }>;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [data, setData] = useState<HomeData | null>(null);
  const [weeksAway, setWeeksAway] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [selectedKey, setSelectedKey] = useState(() => dateKey(new Date()));

  // The Week Schedule screen can send us back with a day to select (?date=2026-11-24).
  const params = useLocalSearchParams<{ date?: string }>();
  useEffect(() => {
    if (!params.date) return;
    const day = parseDateKey(params.date);
    setWeekStart(weekStartOf(day));
    setDirection(0);
    setSelectedKey(params.date);
  }, [params.date]);

  // Reload every time Home comes into view, and when the week changes.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [{ rotation, workout }, name, activeId, plans, days] = await Promise.all([
          getToday(db),
          getSetting(db, 'user_name'),
          getActiveSessionId(db),
          getRoutineCards(db),
          getWeekSchedule(db, weekStart),
        ]);
        const previews: HomeData['previews'] = {};
        for (const w of [workout, ...days.map((d) => d.planned)]) {
          if (w && !previews[w.id]) {
            const p = await getWorkoutPreview(db, w.id);
            previews[w.id] = { minutes: p.minutes, exercises: p.plan.length };
          }
        }
        let active: HomeData['active'] = null;
        if (activeId != null) {
          const d = await getSessionDetail(db, activeId);
          if (d) {
            const setsDone = d.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt != null && !s.isWarmup).length;
            active = { name: d.workoutName, setsDone };
          }
        }
        setData({ name, rotation, workout, active, plans, days, previews });
        setWeeksAway(activeId == null ? await freshStartOffer(db) : null);
      })();
    // reloadKey is listed on purpose: bumping it forces a reload (e.g. after Fresh Start).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, reloadKey, weekStart]),
  );

  const thisWeek = weekStartOf(new Date());
  const isCurrentWeek = isSameDay(weekStart, thisWeek);

  function goToWeek(next: Date, dir: -1 | 0 | 1) {
    setDirection(dir);
    setWeekStart(next);
    // Select today if it's in that week, otherwise its Monday.
    setSelectedKey(isSameDay(next, thisWeek) ? dateKey(new Date()) : dateKey(next));
  }

  if (!data) return <Screen>{null}</Screen>;

  const { rotation, workout, active, previews } = data;
  const selected = data.days.find((d) => d.key === selectedKey) ?? data.days[0];
  const doneCount = rotation.done.size;
  const isUpNext = workout ? !rotation.done.has(workout.id) : true;
  const statusLine = !workout
    ? ''
    : isUpNext
      ? `${workout.name} is up next · ${doneCount} of ${rotation.workouts.length} done this cycle`
      : `${workout.name} was already done on ${shortDate(rotation.done.get(workout.id)!)} this cycle`;

  const openPreview = () => workout && router.push({ pathname: '/workout/preview', params: { id: workout.id } });
  const changeFor = (day: ScheduleDay) =>
    router.push(day.isToday ? '/workout/change' : { pathname: '/workout/change', params: { date: day.key } });

  /** The card for the selected day. */
  function DayCard() {
    // ---- Today ----
    if (selected.isToday) {
      if (active) {
        return (
          <Hero>
            <AppText variant="small" color={colors.onHeroMuted}>
              IN PROGRESS
            </AppText>
            <HeroTitle>{active.name}</HeroTitle>
            <AppText color={colors.onHeroMuted}>
              {active.setsDone} {active.setsDone === 1 ? 'set' : 'sets'} logged so far
            </AppText>
            <HeroButton title="Resume Workout" onPress={() => router.push('/workout/active')} />
          </Hero>
        );
      }
      if (selected.sessions.length > 0) {
        return (
          <View style={{ gap: spacing.sm }}>
            <CompletedCard day={selected} summary={selected.sessions[selected.sessions.length - 1]} />
            {workout && (
              <Pressable onPress={openPreview} hitSlop={8} style={{ alignSelf: 'center', padding: spacing.sm }}>
                <AppText variant="small" muted style={{ textDecorationLine: 'underline' }}>
                  Train again? Start {workout.name}
                </AppText>
              </Pressable>
            )}
          </View>
        );
      }
      if (!workout) return <EmptyPlanCard />;
      const p = previews[workout.id];
      return (
        <View style={{ gap: spacing.sm }}>
          <Pressable onPress={openPreview} accessibilityLabel={`Preview ${workout.name}`}>
            <Hero>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText variant="small" color={colors.onHeroMuted} style={{ flex: 1, letterSpacing: 0.5 }}>
                  TODAY&apos;S WORKOUT
                </AppText>
                <HeroChip>{isUpNext ? 'Up next' : 'Done'}</HeroChip>
              </View>
              <HeroTitle>{workout.name}</HeroTitle>
              <AppText color={colors.onHeroMuted}>{workout.muscleLabel}</AppText>
              {p && <PreviewChips minutes={p.minutes} exercises={p.exercises} />}
              <HeroButton title="Start Workout" onPress={openPreview} />
              <HeroOutlineButton title="Change Workout" onPress={() => changeFor(selected)} />
            </Hero>
          </Pressable>
          <AppText variant="small" muted style={{ paddingHorizontal: spacing.xs }}>
            {statusLine}
          </AppText>
        </View>
      );
    }

    // ---- Past day ----
    if (selected.sessions.length > 0) {
      return <CompletedCard day={selected} summary={selected.sessions[selected.sessions.length - 1]} />;
    }

    // ---- Future day with a planned workout ----
    if (selected.isFuture && selected.planned) {
      const w = selected.planned;
      const p = previews[w.id];
      return (
        <Hero>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText variant="small" color={colors.onHeroMuted} style={{ flex: 1, letterSpacing: 0.5 }}>
              {format(selected.date, 'EEEE d MMM').toUpperCase()}
            </AppText>
            <HeroChip>Planned</HeroChip>
          </View>
          <HeroTitle>{w.name}</HeroTitle>
          <AppText color={colors.onHeroMuted}>{w.muscleLabel}</AppText>
          {p && <PreviewChips minutes={p.minutes} exercises={p.exercises} />}
          <HeroButton title="Start Workout" disabled onPress={() => {}} />
          <AppText variant="small" color={colors.onHeroMuted} style={{ textAlign: 'center' }}>
            You can start this on {format(selected.date, 'EEE d MMM')}
          </AppText>
          <HeroOutlineButton title="Change Workout" onPress={() => changeFor(selected)} />
        </Hero>
      );
    }

    // ---- Rest day, or a past day with nothing logged ----
    return <EmptyDayCard day={selected} onPlan={() => changeFor(selected)} />;
  }

  function EmptyPlanCard() {
    return (
      <Card>
        <AppText variant="heading">{rotation.routine.name}</AppText>
        <AppText muted>This plan has no workouts yet. Add some in the Plan Editor.</AppText>
        <Button
          title="Open Plan"
          onPress={() => router.push({ pathname: '/routine/[routineId]', params: { routineId: rotation.routine.id } })}
        />
      </Card>
    );
  }

  return (
    <Screen>
      {/* Greeting (light lead-in, name in semibold) + settings */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 34, fontWeight: '300', letterSpacing: -0.6 }}>
            {greeting()}
            {data.name ? ',' : ''}
          </AppText>
          {data.name && (
            <AppText style={{ fontSize: 34, fontWeight: '700', letterSpacing: -0.6 }}>{data.name}</AppText>
          )}
        </View>
        {/* Week calendar + settings, side by side with a gap so they never overlap. */}
        <View style={{ flexDirection: 'row', gap: spacing.md, alignSelf: 'flex-start' }}>
          <RoundButton
            icon="calendar"
            label="Week schedule"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push({ pathname: '/week', params: { start: dateKey(weekStart) } });
            }}
          />
          <RoundButton icon="slider.horizontal.3" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <WeekStrip
        weekStart={weekStart}
        days={data.days}
        selectedKey={selected.key}
        isCurrentWeek={isCurrentWeek}
        direction={direction}
        onSelect={(d) => setSelectedKey(d.key)}
        onWeek={(delta) => goToWeek(addWeeks(weekStart, delta), delta)}
        onToday={() => goToWeek(thisWeek, weekStart > thisWeek ? -1 : 1)}
      />

      {weeksAway != null && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <AppText variant="label" style={{ flex: 1 }}>
              Welcome back. Want to ease in?
            </AppText>
            <Pressable
              onPress={async () => {
                await dismissFreshStart(db);
                setWeeksAway(null);
              }}
              hitSlop={12}
              accessibilityLabel="Dismiss">
              <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
            </Pressable>
          </View>
          <AppText variant="small" muted>
            It&apos;s been {weeksAway} weeks. A fresh start restarts the cycle, with weights about 10% lighter for your
            first session back on each exercise.
          </AppText>
          <Button
            title="Fresh Start"
            kind="secondary"
            onPress={async () => {
              await acceptFreshStart(db);
              setReloadKey((k) => k + 1);
            }}
          />
        </Card>
      )}

      <DayCard />

      {/* Your plans */}
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            Your plans
          </AppText>
          <Pressable onPress={() => router.push('/plans')} hitSlop={12}>
            <AppText variant="label" muted style={{ textDecorationLine: 'underline' }}>
              Manage
            </AppText>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md }}
          style={{ marginHorizontal: -spacing.lg }}>
          <View style={{ width: spacing.xs }} />
          {data.plans.map((p) => (
            <Pressable
              key={p.routine.id}
              onPress={() => router.push({ pathname: '/routine/[routineId]', params: { routineId: p.routine.id } })}
              style={{
                width: 230,
                padding: spacing.lg,
                gap: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                borderWidth: p.active ? 2 : 1,
                borderColor: p.active ? colors.accent : colors.border,
              }}>
              <AppText variant="label" numberOfLines={1} style={{ fontSize: 18 }}>
                {p.routine.name}
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Chip>{`${p.days} ${p.days === 1 ? 'day' : 'days'}`}</Chip>
                {p.minutes > 0 && <Chip>{`~${p.minutes} min`}</Chip>}
                {p.active && <Chip strong>Active</Chip>}
              </View>
            </Pressable>
          ))}
          <View style={{ width: spacing.xs }} />
        </ScrollView>
      </View>

      <AppText variant="small" muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
        “{quoteOfTheDay()}”
      </AppText>
    </Screen>
  );
}

function RoundButton({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      <SymbolView name={icon} size={20} tintColor={colors.text} />
    </Pressable>
  );
}

function PreviewChips({ minutes, exercises }: { minutes: number; exercises: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
      <HeroChip icon="clock">{`${minutes} min`}</HeroChip>
      <HeroChip icon="list.bullet">{`${exercises} exercises`}</HeroChip>
    </View>
  );
}

function Chip({ children, strong }: { children: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        minHeight: 28,
        borderRadius: 999,
        backgroundColor: strong ? colors.accent : colors.accentSoft,
      }}>
      <AppText variant="small" color={strong ? colors.onAccent : colors.text}>
        {children}
      </AppText>
    </View>
  );
}
