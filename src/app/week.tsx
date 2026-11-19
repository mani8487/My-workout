/**
 * Week Schedule, as a "focus wheel" (inspired by the reference video):
 *  - Days scroll vertically and snap. The day in the middle grows into a big
 *    card with its workout details; the others shrink into small circles with
 *    a label beside them. A light haptic ticks as each day reaches the middle.
 *  - Tap a small day to bring it to the middle. Tap the middle card and it
 *    expands to fill the screen with that day's details and actions; ✕ shrinks
 *    it back into place.
 *
 * Actions from the expanded day: a finished workout opens its session, today's
 * plan opens its preview (to start), any other day goes to Home with it selected.
 */
import { addDays, addWeeks, format, isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Pressable, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { Backdrop } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { getWorkouts } from '@/db/plan';
import type { Workout } from '@/db/types';
import { formatDuration } from '@/logic/format';
import { getWeekSchedule, parseDateKey, weekStartOf, type ScheduleDay } from '@/logic/schedule';
import { getWorkoutPreview } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, spacing } from '@/theme/typography';

type Row = {
  day: ScheduleDay;
  title: string;
  muscles: string;
  meta: string;
  icon: SFSymbol;
  badge: 'Done' | 'Today' | 'Upcoming' | 'Rest' | 'Missed';
};

/** Height of one slot in the wheel, and the small circle size. */
const ITEM_H = 128;
const SMALL = 72;
const BIG_H = 116;

type Rect = { x: number; y: number; w: number; h: number };
/** A handle to an on-screen view, used to measure where it is. */
type ViewHandle = ComponentRef<typeof View>;

export default function WeekScheduleScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const params = useLocalSearchParams<{ start?: string }>();
  const [weekStart, setWeekStart] = useState(() =>
    params.start ? weekStartOf(parseDateKey(params.start)) : weekStartOf(new Date()),
  );
  const [rows, setRows] = useState<Row[] | null>(null);
  const [viewportH, setViewportH] = useState(0);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const rootRef = useRef<ViewHandle>(null);
  const bubbleRefs = useRef<(ViewHandle | null)[]>([]);

  // Expanded (full-screen) day.
  const [expanded, setExpanded] = useState<{ row: Row; from: Rect } | null>(null);
  const grow = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [days, workouts] = await Promise.all([getWeekSchedule(db, weekStart), getWorkouts(db)]);
        const byId = new Map<string, Workout>(workouts.map((w) => [w.id, w]));
        const out: Row[] = [];
        for (const day of days) {
          const done = day.sessions[day.sessions.length - 1];
          if (done) {
            const w = byId.get(done.workoutId);
            out.push({
              day,
              title: done.workoutName,
              muscles: w?.muscleLabel ?? '',
              meta: [done.durationMin != null ? formatDuration(done.durationMin) : null, `${done.exercises} exercises`]
                .filter(Boolean)
                .join(' · '),
              icon: (w?.icon as SFSymbol) ?? 'checkmark.circle',
              badge: 'Done',
            });
          } else if (day.planned) {
            const p = await getWorkoutPreview(db, day.planned.id);
            out.push({
              day,
              title: day.planned.name,
              muscles: day.planned.muscleLabel,
              meta: `about ${p.minutes} min · ${p.plan.length} exercises`,
              icon: day.planned.icon as SFSymbol,
              badge: day.isToday ? 'Today' : 'Upcoming',
            });
          } else {
            const missed = day.status === 'missed';
            out.push({
              day,
              title: missed ? 'No workout logged' : 'Rest day',
              muscles: '',
              meta: missed ? 'Planned training day' : 'Recovery',
              icon: missed ? 'exclamationmark.circle' : 'moon.zzz',
              badge: missed ? 'Missed' : day.isToday ? 'Today' : 'Rest',
            });
          }
        }
        setRows(out);
        // Start with today in the middle (or Monday for other weeks).
        const start = Math.max(0, out.findIndex((r) => r.day.isToday));
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: start * ITEM_H, animated: false }));
      })();
    }, [db, weekStart, scrollRef]),
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Light tick each time a new day reaches the middle.
  const tick = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);
  useAnimatedReaction(
    () => Math.round(scrollY.value / ITEM_H),
    (cur, prev) => {
      if (prev !== null && cur !== prev) scheduleOnRN(tick);
    },
  );

  function changeWeek(delta: -1 | 1) {
    tick();
    setRows(null);
    setWeekStart((w) => addWeeks(w, delta));
  }

  function tapDay(index: number) {
    const centered = Math.round(scrollY.value / ITEM_H);
    if (index !== centered) {
      scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: true });
      return;
    }
    // Expand the middle card to full screen, starting from where it is now.
    const bubble = bubbleRefs.current[index];
    const root = rootRef.current;
    if (!bubble || !root || !rows) return;
    root.measureInWindow((rx: number, ry: number) => {
      bubble.measureInWindow((bx: number, by: number, bw: number, bh: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setExpanded({ row: rows[index], from: { x: bx - rx, y: by - ry, w: bw, h: bh } });
        grow.value = 0;
        grow.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      });
    });
  }

  function collapse() {
    grow.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(setExpanded, null);
    });
  }

  function act(row: Row) {
    tick();
    const done = row.day.sessions[row.day.sessions.length - 1];
    if (done) router.push({ pathname: '/session/[id]', params: { id: String(done.sessionId) } });
    else if (row.day.isToday && row.day.planned) router.push({ pathname: '/workout/preview', params: { id: row.day.planned.id } });
    else router.navigate({ pathname: '/', params: { date: row.day.key } });
  }

  const padV = Math.max(0, (viewportH - ITEM_H) / 2);
  const cardW = screenW - spacing.lg * 2;
  const isThisWeek = isSameDay(weekStart, weekStartOf(new Date()));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View ref={rootRef} style={{ flex: 1 }} collapsable={false}>
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

        {/* The wheel */}
        <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setViewportH(e.nativeEvent.layout.height)}>
          {viewportH > 0 && (
            <Animated.ScrollView
              ref={scrollRef}
              onScroll={onScroll}
              scrollEventThrottle={16}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: padV, paddingHorizontal: spacing.lg }}>
              {rows?.map((row, i) => (
                <DayBubble
                  key={row.day.key}
                  row={row}
                  index={i}
                  scrollY={scrollY}
                  cardW={cardW}
                  hidden={expanded?.row.day.key === row.day.key}
                  setRef={(r) => {
                    bubbleRefs.current[i] = r;
                  }}
                  onPress={() => tapDay(i)}
                />
              ))}
            </Animated.ScrollView>
          )}
        </View>

        {expanded && (
          <ExpandedDay row={expanded.row} from={expanded.from} grow={grow} onClose={collapse} onAct={() => act(expanded.row)} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** One day in the wheel: a big card in the middle, a small circle elsewhere. */
function DayBubble({
  row,
  index,
  scrollY,
  cardW,
  hidden,
  setRef,
  onPress,
}: {
  row: Row;
  index: number;
  scrollY: SharedValue<number>;
  cardW: number;
  hidden: boolean;
  setRef: (r: ViewHandle | null) => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const today = row.day.isToday;

  // 0 = in the middle, 1 = one slot away, 2+ = further.
  const bubble = useAnimatedStyle(() => {
    const d = Math.abs(index - scrollY.value / ITEM_H);
    const t = Math.min(d, 1);
    return {
      width: interpolate(t, [0, 1], [cardW, SMALL]),
      height: interpolate(t, [0, 1], [BIG_H, SMALL]),
      borderRadius: interpolate(t, [0, 1], [28, SMALL / 2]),
      opacity: interpolate(d, [0, 1, 3], [1, 0.85, 0.35], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [1, 3], [1, 0.82], Extrapolation.CLAMP) }],
    };
  });
  const details = useAnimatedStyle(() => {
    const d = Math.abs(index - scrollY.value / ITEM_H);
    return { opacity: interpolate(d, [0, 0.45], [1, 0], Extrapolation.CLAMP) };
  });
  const compact = useAnimatedStyle(() => {
    const d = Math.abs(index - scrollY.value / ITEM_H);
    return { opacity: interpolate(d, [0.35, 0.8], [0, 1], Extrapolation.CLAMP) };
  });

  const gradient: [string, string] =
    row.badge === 'Rest' || row.badge === 'Missed' ? [colors.cardAlt, colors.card] : [colors.heroStart, colors.heroEnd];
  const ink = row.badge === 'Rest' || row.badge === 'Missed' ? colors.text : colors.onHero;
  const inkMuted = row.badge === 'Rest' || row.badge === 'Missed' ? colors.textMuted : colors.onHeroMuted;

  return (
    <View style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'flex-end' }}>
      {/* Label beside the small circle (fades out in the middle) */}
      <Animated.View style={[{ position: 'absolute', left: 0, right: SMALL + spacing.md }, compact]} pointerEvents="none">
        <AppText variant="small" muted>
          {format(row.day.date, 'EEEE d MMM').toUpperCase()}
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {row.title}
        </AppText>
        <AppText variant="small" muted numberOfLines={1}>
          {row.badge}
        </AppText>
      </Animated.View>

      <Pressable onPress={onPress} accessibilityLabel={`${format(row.day.date, 'EEEE d MMMM')}: ${row.title}, ${row.badge}`}>
        <Animated.View
          ref={setRef}
          collapsable={false}
          style={[
            {
              overflow: 'hidden',
              borderWidth: today ? 2 : 1,
              borderColor: today ? colors.accent : colors.border,
              opacity: hidden ? 0 : 1,
            },
            bubble,
          ]}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
            {/* Small: the date */}
            <Animated.View
              style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, compact]}
              pointerEvents="none">
              <AppText variant="small" color={inkMuted}>
                {format(row.day.date, 'EEE')}
              </AppText>
              <AppText variant="heading" color={ink}>
                {format(row.day.date, 'd')}
              </AppText>
            </Animated.View>

            {/* Big: the workout */}
            <Animated.View
              style={[{ flex: 1, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, details]}
              pointerEvents="none">
              <View style={{ width: 52, alignItems: 'center' }}>
                <AppText variant="small" color={inkMuted}>
                  {format(row.day.date, 'EEE')}
                </AppText>
                <AppText style={{ fontSize: 30, fontWeight: '700' }} color={ink}>
                  {format(row.day.date, 'd')}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="heading" numberOfLines={1} color={ink}>
                  {row.title}
                </AppText>
                <AppText variant="small" numberOfLines={1} color={inkMuted}>
                  {row.muscles || row.meta}
                </AppText>
                {row.muscles ? (
                  <AppText variant="small" numberOfLines={1} color={inkMuted}>
                    {row.meta}
                  </AppText>
                ) : null}
              </View>
              <Badge badge={row.badge} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** The middle card blown up to fill the screen. */
function ExpandedDay({
  row,
  from,
  grow,
  onClose,
  onAct,
}: {
  row: Row;
  from: Rect;
  grow: SharedValue<number>;
  onClose: () => void;
  onAct: () => void;
}) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rest = row.badge === 'Rest' || row.badge === 'Missed';
  const ink = rest ? colors.text : colors.onHero;
  const inkMuted = rest ? colors.textMuted : colors.onHeroMuted;
  const gradient: [string, string] = rest ? [colors.cardAlt, colors.card] : [colors.heroStart, colors.heroEnd];

  const frame = useAnimatedStyle(() => ({
    left: interpolate(grow.value, [0, 1], [from.x, 0]),
    top: interpolate(grow.value, [0, 1], [from.y, 0]),
    width: interpolate(grow.value, [0, 1], [from.w, size.w || from.w]),
    height: interpolate(grow.value, [0, 1], [from.h, size.h || from.h]),
    borderRadius: interpolate(grow.value, [0, 1], [28, 0]),
  }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(grow.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(grow.value, [0.55, 1], [16, 0], Extrapolation.CLAMP) }],
  }));

  const done = row.day.sessions[row.day.sessions.length - 1];
  const actionLabel = done
    ? 'View Full Session'
    : row.day.isToday && row.day.planned
      ? 'Preview & Start'
      : row.day.isFuture
        ? 'Open This Day'
        : 'Log or Review This Day';

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, frame]}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
          <Animated.View style={[{ flex: 1, padding: spacing.xl, gap: spacing.md }, content]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="small" color={inkMuted} style={{ flex: 1, letterSpacing: 0.5 }}>
                {format(row.day.date, 'EEEE d MMMM').toUpperCase()}
              </AppText>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityLabel="Close day"
                style={{
                  width: MIN_TAP,
                  height: MIN_TAP,
                  borderRadius: MIN_TAP / 2,
                  backgroundColor: rest ? colors.card : colors.heroChip,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <SymbolView name="xmark" size={16} tintColor={ink} />
              </Pressable>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
              <SymbolView name={row.icon} size={64} tintColor={ink} />
              <AppText style={{ fontSize: 44, fontWeight: '700', letterSpacing: -0.8 }} color={ink}>
                {row.title}
              </AppText>
              {row.muscles ? <AppText color={inkMuted}>{row.muscles}</AppText> : null}
              <AppText variant="label" color={inkMuted}>
                {row.meta}
              </AppText>
              <View style={{ flexDirection: 'row' }}>
                <Badge badge={row.badge} />
              </View>
            </View>

            <Pressable
              onPress={onAct}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: 56,
                borderRadius: 999,
                backgroundColor: rest ? colors.accent : colors.heroButton,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}>
              <AppText variant="heading" style={{ fontSize: 20 }} color={rest ? colors.onAccent : colors.onHeroButton}>
                {actionLabel}
              </AppText>
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function Badge({ badge }: { badge: Row['badge'] }) {
  const { colors } = useTheme();
  const style = {
    Done: { bg: colors.successSoft, fg: colors.success },
    Today: { bg: colors.accent, fg: colors.onAccent },
    Upcoming: { bg: colors.heroChip, fg: colors.onHero },
    Rest: { bg: colors.accentSoft, fg: colors.text },
    Missed: { bg: colors.dangerSoft, fg: colors.danger },
  }[badge];
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: 999, backgroundColor: style.bg }}>
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
