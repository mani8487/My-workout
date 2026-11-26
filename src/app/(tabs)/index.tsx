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
 *
 * Mist & Mint is the Living Home, all on one screen with no scrolling: greeting
 * with calendar and settings, the week strip, the room (the scene itself shows
 * today's progress, and takes whatever height is left), one status line, the
 * day card, "+ Log movement" beside a slim water chip, and the day's logs as pills. The room catches
 * up from what you last saw, buzzes lightly when a log lands, and resets at
 * midnight or when the app wakes on a new day.
 */
import { addDays, addWeeks, format, isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CompletedCard, EmptyDayCard } from '@/components/day-cards';
import { ActiveTodayCard, DayLogList, LogChips } from '@/components/active-today';
import { CompactDayCard } from '@/components/compact-day-card';
import { GlassTile } from '@/components/glass-tile';
import { MistDayCard } from '@/components/mist-day-card';
import { LivingScene } from '@/components/scene/living-scene';
import { TopActions } from '@/components/top-actions';
import { WaterChip } from '@/components/water-chip';
import { useWaterToday } from '@/db/water';
import { catchUpFrom, dayKeyOf, encodeLastSeen, LAST_SEEN_KEY } from '@/logic/day';
import { minutesText, moodSentence, sceneTarget } from '@/logic/scene-state';
import { useTodayKey } from '@/logic/use-today';
import { deleteQuickLog, getActiveMinutesBetween, getQuickLogsBetween, type QuickLog } from '@/db/quick-log';
import { ACTIVE_GOAL_KEY, DEFAULT_ACTIVE_GOAL_MIN } from '@/logic/activity';
import { Hero, HeroButton, HeroChip, HeroOutlineButton, HeroTitle } from '@/components/hero';
import { Backdrop, Screen } from '@/components/screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeekStrip } from '@/components/week-strip';
import { getLastSessionHighlight } from '@/db/history';
import { formatDuration, formatKg } from '@/logic/format';
import { getActiveSessionId, getSessionDetail } from '@/db/sessions';
import { getSetting, setSetting } from '@/db/settings';
import type { Workout } from '@/db/types';
import { acceptFreshStart, dismissFreshStart, freshStartOffer } from '@/logic/fresh-start';
import type { Rotation } from '@/logic/rotation';
import { dateKey, getWeekSchedule, parseDateKey, weekStartOf, type ScheduleDay } from '@/logic/schedule';
import { getRoutineCards, getToday, getWorkoutPreview, greeting, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { isMistTheme, MIN_TAP, radius, SERIF_ITALIC, spacing } from '@/theme/typography';

/** Living Home: the room never gets shorter than this; a very small phone scrolls instead. */
const ROOM_MIN_HEIGHT = 170;

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
  /** Quick logs in the shown week. */
  logs: QuickLog[];
  /** Today's active minutes (workouts + quick logs) and the daily goal. */
  activeToday: number;
  goal: number;
  /** Living Home: the hour this data was loaded at (sets the sky). */
  hour: number;
  /** The local day this data was loaded for. */
  day: string;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { colors, name: themeName } = useTheme();
  // Ember uses the quiet Apple-style row card and a small serif date.
  const compact = themeName === 'ember';
  const mist = isMistTheme(themeName);
  const [data, setData] = useState<HomeData | null>(null);
  const [weeksAway, setWeeksAway] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [selectedKey, setSelectedKey] = useState(() => dateKey(new Date()));
  const todayKey = useTodayKey();
  const { fontScale } = useWindowDimensions();
  const [roomHeight, setRoomHeight] = useState(0);
  // Water logged while a sheet covers Home lands in the room once Home is back in view:
  // the room holds its changes until it's on screen again (see LivingScene).
  const water = useWaterToday();
  const focused = useIsFocused();

  // A new day (midnight, or the app waking on a new day): move "today" along with it.
  const prevToday = useRef(todayKey);
  useEffect(() => {
    const old = prevToday.current;
    if (old === todayKey) return;
    prevToday.current = todayKey;
    setSelectedKey((k) => (k === old ? todayKey : k));
    setWeekStart((w) => (isSameDay(w, weekStartOf(parseDateKey(old))) ? weekStartOf(new Date()) : w));
  }, [todayKey]);

  // Coming back from the background (not just Control Center): reload, so the room catches up.
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (s) => {
      if (last === 'background' && s === 'active') setReloadKey((k) => k + 1);
      last = s;
    });
    return () => sub.remove();
  }, []);

  // Living Home: a light buzz when a movement you just logged lands in the room.
  // Set when "+ Log movement" opens the sheet; checked (and cleared) on the very next reload.
  const logPending = useRef(false);
  const prevMinutes = useRef<{ day: string; minutes: number } | null>(null);
  // Where the room's first catch-up starts; captured once, on the first load.
  const [sceneFrom, setSceneFrom] = useState<{ stage: number; water: number } | null>(null);
  const logMovement = () => {
    logPending.current = true;
    router.push('/quick-log');
  };

  // The Week Schedule screen can send us back with a day to select (?date=2026-11-24).
  // Handled once per new value, while rendering (React's pattern for reacting to a changed prop).
  const params = useLocalSearchParams<{ date?: string }>();
  const [handledDate, setHandledDate] = useState<string | undefined>(undefined);
  if (params.date && params.date !== handledDate) {
    setHandledDate(params.date);
    setWeekStart(weekStartOf(parseDateKey(params.date)));
    setDirection(0);
    setSelectedKey(params.date);
  }

  // Reload every time Home comes into view, and when the week changes.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [{ rotation, workout }, name, activeId, plans, days, logs, activeToday, goalSetting, lastSeen] = await Promise.all([
          getToday(db),
          getSetting(db, 'user_name'),
          getActiveSessionId(db),
          getRoutineCards(db),
          getWeekSchedule(db, weekStart),
          getQuickLogsBetween(db, weekStart.getTime(), addDays(weekStart, 7).getTime()),
          getActiveMinutesBetween(db, todayStart.getTime(), addDays(todayStart, 1).getTime()),
          getSetting(db, ACTIVE_GOAL_KEY),
          getSetting(db, LAST_SEEN_KEY),
        ]);
        const now = new Date();
        const hour = now.getHours() + now.getMinutes() / 60;
        const day = dayKeyOf(todayStart);
        const goal = Number(goalSetting) > 0 ? Number(goalSetting) : DEFAULT_ACTIVE_GOAL_MIN;
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
        setData({ name, rotation, workout, active, plans, days, previews, logs, activeToday, goal, hour, day });
        setSceneFrom((f) => f ?? catchUpFrom(lastSeen, day));
        const before = prevMinutes.current;
        prevMinutes.current = { day, minutes: activeToday };
        // A log that lands just after midnight counts from 0, not from yesterday's total.
        const was = before?.day === day ? before.minutes : 0;
        if (logPending.current && before != null && activeToday > was) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        logPending.current = false;
        setWeeksAway(activeId == null ? await freshStartOffer(db) : null);
      })();
    // reloadKey is listed on purpose: bumping it forces a reload (e.g. after Fresh Start).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, reloadKey, weekStart, todayKey]),
  );

  // Remember what the room shows, so a cold start can catch up from it. Only
  // when both numbers are for today, so yesterday's room is never saved as today's.
  const target = data && water ? sceneTarget({ activeMinutes: data.activeToday, goalMinutes: data.goal, waterMl: water.ml, waterGoalMl: water.goal }) : null;
  const fresh = data?.day === todayKey && water?.day === todayKey;
  useEffect(() => {
    // Only while Home is in view: changes made elsewhere count as "seen" once the room has shown them.
    if (!mist || !target || !fresh || !focused) return;
    setSetting(db, LAST_SEEN_KEY, encodeLastSeen({ day: todayKey, stage: target.stage, water: target.water })).catch(() => {});
    // Saved whenever what the room shows changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, mist, fresh, focused, todayKey, target?.stage, target?.water]);

  // A real line from your last session of this workout (instead of a stock quote).
  const highlightFor = data?.workout?.id ?? null;
  const [highlight, setHighlight] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!highlightFor) {
        setHighlight(null);
        return;
      }
      getLastSessionHighlight(db, highlightFor).then((h) =>
        setHighlight(
          h ? `Last ${h.workoutName}: ${h.exerciseName} ${h.weightKg ? `${formatKg(h.weightKg)} kg` : 'bodyweight'} × ${h.reps}` : null,
        ),
      );
    }, [db, highlightFor]),
  );

  const thisWeek = weekStartOf(new Date());
  const isCurrentWeek = isSameDay(weekStart, thisWeek);

  function goToWeek(next: Date, dir: -1 | 0 | 1) {
    setDirection(dir);
    setWeekStart(next);
    // Select today if it's in that week, otherwise its Monday.
    setSelectedKey(isSameDay(next, thisWeek) ? dateKey(new Date()) : dateKey(next));
  }

  if (!data || (mist && !water)) return <SkeletonScreen />;

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
  function renderDayCard() {
    // ---- Mist & Mint: one calm card style (finished and rest days use the shared cards below) ----
    if (mist) {
      const detailFor = (w: Workout) => {
        const p = previews[w.id];
        if (!p) return w.muscleLabel;
        return [p.minutes ? `${p.minutes} min` : null, `${p.exercises} ${p.exercises === 1 ? 'exercise' : 'exercises'}`]
          .filter(Boolean)
          .join(' · ');
      };
      if (selected.isToday && active) {
        const resume = () => router.push('/workout/active');
        return (
          <MistDayCard
            eyebrow="In progress"
            title={active.name}
            detail={`${active.setsDone} ${active.setsDone === 1 ? 'set' : 'sets'} logged so far`}
            onPress={resume}
            button={{ title: 'Resume Workout', onPress: resume }}
          />
        );
      }
      if (selected.isToday && selected.sessions.length === 0) {
        if (!workout) return renderEmptyPlanCard();
        return (
          <MistDayCard
            eyebrow="Today's Workout"
            title={workout.name}
            detail={detailFor(workout)}
            onPress={openPreview}
            button={{ title: 'Start Workout', onPress: openPreview }}
            secondary={{ title: 'Change', label: 'Change workout', onPress: () => changeFor(selected) }}
          />
        );
      }
      if (selected.isFuture && selected.planned && selected.sessions.length === 0) {
        const w = selected.planned;
        return (
          <MistDayCard
            eyebrow={`Planned for ${format(selected.date, 'EEEE')}`}
            title={w.name}
            detail={detailFor(w)}
            secondary={{ title: 'Change workout', onPress: () => changeFor(selected) }}
          />
        );
      }
      if (selected.sessions.length > 0) {
        const s = selected.sessions[selected.sessions.length - 1];
        const open = () => router.push({ pathname: '/session/[id]', params: { id: String(s.sessionId) } });
        const more = selected.sessions.length - 1;
        return (
          <MistDayCard
            eyebrow={selected.isToday ? 'Done today' : `Done · ${format(selected.date, 'EEEE d MMM')}`}
            title={s.workoutName}
            detail={[s.durationMin != null ? formatDuration(s.durationMin) : null, `${s.workingSets} sets`, `${s.volumeKg.toLocaleString()} kg`, more > 0 ? `+${more} more` : null]
              .filter(Boolean)
              .join(' · ')}
            onPress={open}
            hint="Opens every set and note"
            button={{ title: 'View session', onPress: open }}
            secondary={selected.isToday && workout ? { title: 'Train again', label: `Train again: ${workout.name}`, onPress: openPreview } : undefined}
          />
        );
      }
      if (selected.isToday && !workout) return renderEmptyPlanCard();
      const missed = selected.status === 'missed';
      return (
        <MistDayCard
          eyebrow={format(selected.date, 'EEEE d MMM')}
          title={selected.isPast && missed ? 'No workout logged' : 'Rest day'}
          detail={selected.isPast ? (missed ? 'A planned day. Forgot to log it?' : 'Nothing planned, nothing logged.') : 'Recovery counts too.'}
          secondary={
            selected.isPast
              ? { title: 'Log a workout', label: 'Log a workout for this day', onPress: () => router.push({ pathname: '/log-workout', params: { date: selected.key } }) }
              : { title: 'Plan a workout', onPress: () => changeFor(selected) }
          }
        />
      );
    }

    // ---- Today ----
    if (selected.isToday) {
      if (active) {
        const resume = () => router.push('/workout/active');
        if (compact) {
          return (
            <CompactDayCard
              eyebrow="In progress"
              title={active.name}
              detail={`${active.setsDone} ${active.setsDone === 1 ? 'set' : 'sets'} logged so far`}
              onPress={resume}
              onPlay={resume}
              playLabel="Resume workout"
            />
          );
        }
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
              <Pressable accessibilityRole="button" onPress={openPreview} hitSlop={8} style={{ alignSelf: 'center', padding: spacing.sm }}>
                <AppText variant="small" color={colors.accent}>
                  Train again? Start {workout.name}
                </AppText>
              </Pressable>
            )}
          </View>
        );
      }
      if (!workout) return renderEmptyPlanCard();
      const p = previews[workout.id];
      if (compact) {
        return (
          <View style={{ gap: spacing.xs }}>
            <CompactDayCard
              eyebrow={isUpNext ? 'Today · up next' : 'Today · done this cycle'}
              title={workout.name}
              detail={[workout.muscleLabel, p?.minutes ? `~${p.minutes} min` : null].filter(Boolean).join(' · ')}
              onPress={openPreview}
              onPlay={openPreview}
            />
            <TextLink title="Change workout" onPress={() => changeFor(selected)} />
          </View>
        );
      }
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
      if (compact) {
        return (
          <View style={{ gap: spacing.xs }}>
            <CompactDayCard
              eyebrow={`Planned · ${format(selected.date, 'EEEE')}`}
              title={w.name}
              detail={[w.muscleLabel, p?.minutes ? `~${p.minutes} min` : null].filter(Boolean).join(' · ')}
            />
            <TextLink title="Change workout" onPress={() => changeFor(selected)} />
          </View>
        );
      }
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
          <AppText variant="label" color={colors.onHero}>
            Planned for {format(selected.date, 'EEEE')}
          </AppText>
          <HeroOutlineButton title="Change Workout" onPress={() => changeFor(selected)} />
        </Hero>
      );
    }

    // ---- Rest day, or a past day with nothing logged ----
    return <EmptyDayCard day={selected} onPlan={() => changeFor(selected)} />;
  }

  function renderEmptyPlanCard() {
    const openPlan = () => router.push({ pathname: '/routine/[routineId]', params: { routineId: rotation.routine.id } });
    if (mist)
      return (
        <MistDayCard eyebrow={rotation.routine.name} title="No workouts yet" detail="Add some in the Plan Editor." button={{ title: 'Open plan', onPress: openPlan }} />
      );
    return (
      <Card>
        <AppText variant="heading">{rotation.routine.name}</AppText>
        <AppText muted>This plan has no workouts yet. Add some in the Plan Editor.</AppText>
        <Button
          title="Open Plan"
          onPress={openPlan}
        />
      </Card>
    );
  }

  const weekStrip = (
    <>
      {/* zIndex keeps the strip's dates tappable above the room (Mist) while it resizes. */}
      <View style={{ zIndex: 1 }}>
      <WeekStrip
        loggedKeys={new Set(data.logs.map((l) => dateKey(new Date(l.loggedAt))))}
        weekStart={weekStart}
        days={data.days}
        selectedKey={selected.key}
        isCurrentWeek={isCurrentWeek}
        direction={direction}
        onSelect={(d) => setSelectedKey(d.key)}
        onWeek={(delta) => goToWeek(addWeeks(weekStart, delta), delta)}
        onToday={() => goToWeek(thisWeek, weekStart > thisWeek ? -1 : 1)}
      />
      </View>
    </>
  );
  const dismissFresh = async () => {
    await dismissFreshStart(db);
    setWeeksAway(null);
  };
  const acceptFresh = async () => {
    await acceptFreshStart(db);
    setReloadKey((k) => k + 1);
  };
  const freshStartCard = weeksAway != null && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <AppText variant="label" style={{ flex: 1 }}>
              Welcome back. Want to ease in?
            </AppText>
            <Pressable
              onPress={dismissFresh}
              hitSlop={12}
              accessibilityLabel="Dismiss">
              <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
            </Pressable>
          </View>
          <AppText variant="small" muted>
            It&apos;s been {weeksAway} weeks. A fresh start restarts the cycle, with weights about 10% lighter for your
            first session back on each exercise.
          </AppText>
          <Button title="Fresh Start" kind="secondary" onPress={acceptFresh} />
        </Card>
      );
  const todaysLogs = data.logs.filter((l) => dateKey(new Date(l.loggedAt)) === selected.key);
  const deleteLog = async (l: QuickLog) => {
    await deleteQuickLog(db, l.id);
    setReloadKey((k) => k + 1);
  };

  if (mist) {
    // Living Home: everything fits on one screen.
    const bigText = fontScale > 1.2;
    // One line, so it doesn't push the room off the screen.
    const freshBanner = weeksAway != null && (
      <GlassTile style={{ flexDirection: 'row', alignItems: 'center', minHeight: MIN_TAP, paddingLeft: spacing.lg, borderRadius: radius.md }}>
        <AppText variant="small" numberOfLines={1} style={{ flex: 1 }}>
          Back after {weeksAway} weeks. Ease in?
        </AppText>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Ease back in?',
              `It's been ${weeksAway} weeks. A fresh start restarts the cycle, with weights about 10% lighter for your first session back on each exercise.`,
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Fresh start', onPress: acceptFresh },
              ],
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Fresh start"
          accessibilityHint="Explains it and asks before restarting the cycle"
          style={{ minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: spacing.md }}>
          <AppText variant="label" color={colors.accent}>
            Fresh start
          </AppText>
        </Pressable>
        <Pressable
          onPress={dismissFresh}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
        </Pressable>
      </GlassTile>
    );
    // The room takes whatever height is left
    // (a very small phone scrolls a little rather than squeeze the room below its minimum).
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
        <Backdrop />
        {/* Backdrop must stay the first child: the tab screen switches the first ScrollView it finds
            to automatic insets, which would add the tab bar's height twice inside this SafeAreaView. */}
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="title" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flex: 1 }}>
              {greeting()}
              {data.name ? `, ${data.name}` : ''}
            </AppText>
            <TopActions showWater={false} onCalendar={() => router.push({ pathname: '/week', params: { start: dateKey(weekStart) } })} />
          </View>
          {weekStrip}
          {/* The room: edge to edge, no card or border, blending into the page. */}
          <View
            style={{ flex: 1, minHeight: ROOM_MIN_HEIGHT, justifyContent: 'flex-end', marginHorizontal: -spacing.lg, marginVertical: -spacing.sm }}
            onLayout={(e) => setRoomHeight(Math.round(e.nativeEvent.layout.height))}>
            {water && sceneFrom && roomHeight > 0 && (
              <LivingScene
                activeMinutes={data.activeToday}
                goalMinutes={data.goal}
                waterMl={water.ml}
                waterGoalMl={water.goal}
                hour={data.hour}
                from={sceneFrom}
                maxHeight={roomHeight}
              />
            )}
          </View>
          {/* VoiceOver already reads this from the room's label, so it's hidden here to avoid saying it twice. */}
          <AppText
            variant="small"
            muted
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            numberOfLines={2}
            style={{ textAlign: 'center' }}>
            <AppText variant="small">{moodSentence(data.activeToday, data.goal)}</AppText> {minutesText(data.activeToday, data.goal)}
          </AppText>
          {freshBanner}
          {renderDayCard()}
          {/* Side by side; stacked with large text so neither gets squeezed. */}
          <View style={{ flexDirection: bigText ? 'column' : 'row', gap: spacing.sm }}>
            <Button title="+ Log movement" kind="secondary" onPress={logMovement} accessibilityLabel="Log movement" style={bigText ? undefined : { flex: 1 }} />
            {water && (
              <View style={bigText ? undefined : { flex: 1 }}>
                <WaterChip water={water} />
              </View>
            )}
          </View>
          <LogChips logs={todaysLogs} onDelete={deleteLog} emptyText={selected.isToday ? 'Nothing logged yet today' : 'Nothing logged this day'} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <Screen>
      {/* Greeting (light lead-in, name in semibold) + settings */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {compact ? (
          <View style={{ flex: 1, paddingTop: spacing.sm }}>
            <AppText variant="small" muted>
              {greeting()}
              {data.name ? `, ${data.name}` : ''}
            </AppText>
            <AppText variant="display">
              {format(new Date(), 'd')}{' '}
              <AppText variant="display" muted style={{ fontFamily: SERIF_ITALIC }}>
                {format(new Date(), 'EEEE')}
              </AppText>
            </AppText>
          </View>
        ) : (
        <View style={{ flex: 1 }}>
          <AppText variant="display" style={{ fontWeight: '300' }}>
            {greeting()}
            {data.name ? ',' : ''}
          </AppText>
          {data.name && <AppText variant="display">{data.name}</AppText>}
        </View>
        )}
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

      {weekStrip}

      {freshStartCard}

      {renderDayCard()}

      <ActiveTodayCard minutes={data.activeToday} goal={data.goal} onLog={() => router.push('/quick-log')} />
      <DayLogList logs={todaysLogs} onDelete={deleteLog} />

      {compact && <WeekSummary days={data.days} onSelect={(d) => setSelectedKey(d.key)} />}

      {/* Your plans */}
      <View style={{ gap: spacing.md, marginTop: compact ? spacing.md : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {compact ? (
            <View style={{ flex: 1 }}>
              <SectionLabel>Your plans</SectionLabel>
            </View>
          ) : (
            <AppText variant="heading" style={{ flex: 1 }}>
              Your plans
            </AppText>
          )}
          <Pressable onPress={() => router.push('/plans')} hitSlop={12} accessibilityRole="button">
            <AppText variant="label" color={colors.accent}>
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
            <Pressable accessibilityRole="button"
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
              <AppText variant="label" numberOfLines={1}>
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

      {highlight && (
        <AppText variant="small" muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
          {highlight}
        </AppText>
      )}
    </Screen>
  );
}

function RoundButton({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={4}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <SymbolView name={icon} size={20} tintColor={colors.text} />
    </PressableScale>
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

/** A quiet accent-coloured text button, centred (Apple's style for secondary actions). */
function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', padding: spacing.sm }}>
      <AppText variant="label" color={colors.accent}>
        {title}
      </AppText>
    </Pressable>
  );
}

/**
 * Ember Home: "This week" tiles and the next planned days, so the screen has a
 * calm rhythm top to bottom instead of everything bunched at the top.
 */
function WeekSummary({ days, onSelect }: { days: ScheduleDay[]; onSelect: (d: ScheduleDay) => void }) {
  const { colors } = useTheme();
  const sessions = days.flatMap((d) => d.sessions);
  const trainingDays = days.filter((d) => d.status !== 'rest').length;
  const tonnes = sessions.reduce((sum, x) => sum + x.volumeKg, 0) / 1000;
  const upcoming = days.filter((d) => d.isFuture && d.planned).slice(0, 3);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.md }}>
      <SectionLabel>This week</SectionLabel>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile label="Workouts" value={String(sessions.length)} unit={trainingDays ? `of ${trainingDays}` : ''} />
        <StatTile label="Volume" value={tonnes >= 10 ? tonnes.toFixed(0) : tonnes.toFixed(1)} unit="t" />
      </View>

      {upcoming.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: spacing.md }}>Coming up</SectionLabel>
          <View style={{ borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden' }}>
            {upcoming.map((d, i) => (
              <Pressable
                key={d.key}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityLabel={`${d.planned!.name}, ${format(d.date, 'EEEE')}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: 56,
                  paddingHorizontal: spacing.lg,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                  backgroundColor: pressed ? colors.cardAlt : 'transparent',
                })}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" numberOfLines={1}>
                    {d.planned!.name}
                  </AppText>
                  <AppText variant="small" muted>
                    {format(d.date, 'EEEE')}
                  </AppText>
                </View>
                <SymbolView name="chevron.right" size={13} tintColor={colors.faint} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function SectionLabel({ children, style }: { children: string; style?: object }) {
  return (
    <AppText variant="small" muted style={[{ letterSpacing: 0.8, paddingHorizontal: spacing.xs }, style]}>
      {children.toUpperCase()}
    </AppText>
  );
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, padding: spacing.lg, gap: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.card }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="title">
        {value}
        {unit ? (
          <AppText variant="body" muted>
            {' '}
            {unit}
          </AppText>
        ) : null}
      </AppText>
    </View>
  );
}
