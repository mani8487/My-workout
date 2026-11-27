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
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { SkeletonScreen } from '@/components/skeleton';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { LogLine } from '@/components/active-today';
import { GlassTile } from '@/components/glass-tile';
import { MistDayCard } from '@/components/mist-day-card';
import { LivingScene } from '@/components/scene/living-scene';
import { MiloLine } from '@/components/scene/milo-line';
import { TopActions } from '@/components/top-actions';
import { WaterChip } from '@/components/water-chip';
import { useWaterToday } from '@/db/water';
import { catchUpFrom, dayKeyOf, encodeLastSeen, LAST_SEEN_KEY, streakDays } from '@/logic/day';
import { cameoFor, type CameoKind } from '@/logic/cameo';
import { decodeShown, encodeShown, nextLine } from '@/logic/milo-voice';
import { minutesText, moodOf, sceneTarget } from '@/logic/scene-state';
import { useTodayKey } from '@/logic/use-today';
import { TRIP } from '@/motion';
import { countWorkoutsBetween, deleteQuickLog, getActiveMinutesBetween, getActivityTimesSince, getQuickLogsBetween, type QuickLog } from '@/db/quick-log';
import { ACTIVE_GOAL_KEY, DEFAULT_ACTIVE_GOAL_MIN } from '@/logic/activity';
import { Backdrop } from '@/components/screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeekStrip } from '@/components/week-strip';
import { formatDuration } from '@/logic/format';
import { getActiveSessionId, getSessionDetail } from '@/db/sessions';
import { getSetting, setSetting } from '@/db/settings';
import type { Workout } from '@/db/types';
import { acceptFreshStart, dismissFreshStart, freshStartOffer } from '@/logic/fresh-start';
import type { Rotation } from '@/logic/rotation';
import { dateKey, getWeekSchedule, parseDateKey, weekStartOf, type ScheduleDay } from '@/logic/schedule';
import { getRoutineCards, getToday, getWorkoutPreview, greeting } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

/** Living Home: the room never gets shorter than this; a very small phone scrolls instead. */
const ROOM_MIN_HEIGHT = 170;
/** How far back to look when counting the activity streak. */
const STREAK_LOOKBACK_DAYS = 120;
/** Settings key: the id of Milo's last line, so the next visit never repeats it. */
const MILO_LINE_KEY = 'milo_last_line';

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
  /** Milo's status line for this visit. */
  voice: string;
  /** A workout was finished today (Milo wears his towel). */
  workoutDone: boolean;
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
      if (last === 'background' && s === 'active') {
        freshLine.current = true; // back in the app: Milo has something new to say
        setReloadKey((k) => k + 1);
      }
      last = s;
    });
    return () => sub.remove();
  }, []);

  // Living Home: a light buzz when a movement you just logged lands in the room.
  // Set when "+ Log movement" opens the sheet; checked (and cleared) on the very next reload.
  const logPending = useRef(false);

  // Living Home: Start Workout plays Milo's exit (perk, hop off toward you, the room eases away),
  // then opens the workout. Coming back to Home plays his return.
  const [departCue, setDepartCue] = useState(0);
  const [arriveCue, setArriveCue] = useState(0);
  // Activity cameos for logs that land while Home is open (not for ones already there at launch).
  const knownLogs = useRef<{ day: string; ids: Set<number> } | null>(null);
  const [cameo, setCameo] = useState<{ cue: number; kinds: CameoKind[] }>({ cue: 0, kinds: [] });
  const away = useRef(false);
  const leaving = useRef(false);
  /** While the start move plays, Home ignores taps (so nothing else opens on top of it). */
  const [locked, setLocked] = useState(false);
  const comeBack = useCallback(() => {
    if (!away.current) return; // already back (never twice)
    away.current = false;
    leaving.current = false;
    setLocked(false);
    setArriveCue((c) => c + 1);
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!away.current) {
        leaving.current = false;
        setLocked(false);
        return;
      }
      // A beat after Home is back in view (the workout screen has faded away), Milo hops back in.
      // Home stays locked until then, so a quick tap on Start can't race the return.
      const t = setTimeout(comeBack, TRIP.arrive);
      return () => clearTimeout(t);
    }, [comeBack]),
  );
  // Stable, so the (memoised) room doesn't re-render for it.
  const todaysWorkoutId = data?.workout?.id;
  const openTodaysPreview = useCallback(() => {
    if (todaysWorkoutId) router.push({ pathname: '/workout/preview', params: { id: todaysWorkoutId, from: 'room' } });
    else comeBack(); // nothing to open after all (today's plan changed mid-move): bring the room back
  }, [todaysWorkoutId, comeBack]);
  /** Set on opening the app and on coming back from the background; the next load gives Milo a new line. */
  const freshLine = useRef(true);
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
      // Only the newest load may show its results (an older one finishing late is dropped).
      let cancelled = false;
      (async () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = addDays(todayStart, -1).getTime();
        const [
          { rotation, workout },
          name,
          activeId,
          plans,
          days,
          logs,
          activeToday,
          goalSetting,
          lastSeen,
          yesterdayMinutes,
          activityTimes,
          workoutsToday,
          lastLine,
          todaysLogs,
        ] = await Promise.all([
          getToday(db),
          getSetting(db, 'user_name'),
          getActiveSessionId(db),
          getRoutineCards(db),
          getWeekSchedule(db, weekStart),
          getQuickLogsBetween(db, weekStart.getTime(), addDays(weekStart, 7).getTime()),
          getActiveMinutesBetween(db, todayStart.getTime(), addDays(todayStart, 1).getTime()),
          getSetting(db, ACTIVE_GOAL_KEY),
          getSetting(db, LAST_SEEN_KEY),
          getActiveMinutesBetween(db, yesterdayStart, todayStart.getTime()),
          getActivityTimesSince(db, addDays(todayStart, -STREAK_LOOKBACK_DAYS).getTime()),
          countWorkoutsBetween(db, todayStart.getTime(), addDays(todayStart, 1).getTime()),
          getSetting(db, MILO_LINE_KEY),
          getQuickLogsBetween(db, todayStart.getTime(), addDays(todayStart, 1).getTime()),
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
        if (cancelled) return;
        // Living Home: logs that weren't there last time (e.g. one just saved in the sheet) get a cameo.
        const seenLogs = knownLogs.current;
        knownLogs.current = { day, ids: new Set(todaysLogs.map((l) => l.id)) };
        if (seenLogs?.day === day) {
          const fresh = todaysLogs.filter((l) => !seenLogs.ids.has(l.id));
          if (fresh.length > 0) setCameo((c) => ({ cue: c.cue + 1, kinds: fresh.map((l) => cameoFor(l.activity)) }));
        }
        // Milo's line: the same one while the situation is the same, a new one (never the last one)
        // when it changes or when you come back to the app.
        const voice = nextLine(
          {
            mood: moodOf(activeToday, goal),
            activeMinutes: activeToday,
            goalMinutes: goal,
            streakDays: streakDays(activityTimes, now),
            yesterdayMinutes,
            workoutDoneToday: workoutsToday > 0,
          },
          day,
          decodeShown(lastLine),
          freshLine.current,
          Math.random(),
        );
        freshLine.current = false;
        setSetting(db, MILO_LINE_KEY, encodeShown({ id: voice.id, key: voice.key })).catch(() => {});
        setData({ name, rotation, workout, active, plans, days, previews, logs, activeToday, goal, hour, day, voice: voice.text, workoutDone: workoutsToday > 0 });
        setSceneFrom((f) => f ?? catchUpFrom(lastSeen, day));
        const before = prevMinutes.current;
        prevMinutes.current = { day, minutes: activeToday };
        // A log that lands just after midnight counts from 0, not from yesterday's total.
        const was = before?.day === day ? before.minutes : 0;
        if (logPending.current && before != null && activeToday > was) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        logPending.current = false;
        const away = activeId == null ? await freshStartOffer(db) : null;
        if (!cancelled) setWeeksAway(away);
      })();
      return () => {
        cancelled = true;
      };
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
    if (!target || !fresh || !focused) return;
    setSetting(db, LAST_SEEN_KEY, encodeLastSeen({ day: todayKey, stage: target.stage, water: target.water })).catch(() => {});
    // Saved whenever what the room shows changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, fresh, focused, todayKey, target?.stage, target?.water]);

  const thisWeek = weekStartOf(new Date());
  const isCurrentWeek = isSameDay(weekStart, thisWeek);

  function goToWeek(next: Date, dir: -1 | 0 | 1) {
    setDirection(dir);
    setWeekStart(next);
    // Select today if it's in that week, otherwise its Monday.
    setSelectedKey(isSameDay(next, thisWeek) ? dateKey(new Date()) : dateKey(next));
  }

  if (!data || !water) return <SkeletonScreen />;

  const { rotation, workout, active, previews } = data;
  const selected = data.days.find((d) => d.key === selectedKey) ?? data.days[0];

  const openPreview = () => workout && router.push({ pathname: '/workout/preview', params: { id: workout.id } });
  const startFromRoom = () => {
    if (!sceneFrom || roomHeight === 0) return openPreview();
    if (leaving.current) return; // one exit per tap
    leaving.current = true;
    setLocked(true);
    away.current = true;
    Haptics.selectionAsync().catch(() => {});
    setDepartCue((c) => c + 1);
  };
  const changeFor = (day: ScheduleDay) =>
    router.push(day.isToday ? '/workout/change' : { pathname: '/workout/change', params: { date: day.key } });

  /** The card for the selected day. */
  function renderDayCard() {
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
          button={{ title: 'Start Workout', onPress: startFromRoom }}
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

  function renderEmptyPlanCard() {
    const openPlan = () => router.push({ pathname: '/routine/[routineId]', params: { routineId: rotation.routine.id } });
    return (
      <MistDayCard eyebrow={rotation.routine.name} title="No workouts yet" detail="Add some in the Plan Editor." button={{ title: 'Open plan', onPress: openPlan }} />
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
  const todaysLogs = data.logs.filter((l) => dateKey(new Date(l.loggedAt)) === selected.key);
  const deleteLog = async (l: QuickLog) => {
    await deleteQuickLog(db, l.id);
    setReloadKey((k) => k + 1);
  };

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
        pointerEvents={locked ? 'none' : 'auto'}
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
              departCue={departCue}
              onDeparted={openTodaysPreview}
              onAbandoned={comeBack}
              arriveCue={arriveCue}
              towel={data.workoutDone}
              cameoCue={cameo.cue}
              cameoKinds={cameo.kinds}
            />
          )}
        </View>
        {/* Milo's voice, then today's minutes and the day's activities as one light line. */}
        <MiloLine text={data.voice} />
        <View style={{ marginTop: -spacing.md }}>
          <LogLine
            lead={selected.isToday ? minutesText(data.activeToday, data.goal) : null}
            logs={todaysLogs}
            onDelete={deleteLog}
            emptyText={selected.isToday ? 'nothing logged yet' : `Nothing logged on ${format(selected.date, 'EEEE')}`}
          />
        </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}
