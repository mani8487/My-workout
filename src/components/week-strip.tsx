/**
 * The Mon–Sun strip on Home.
 * - Tap a day to select it (dark pill). Today has a ring around its date.
 * - Swipe left/right to move a week at a time. The strip follows your finger
 *   1:1, and a quick flick counts even if it was short. "Today" jumps back.
 * - Marker under each date: filled = done, outline = planned,
 *   none = rest, small red dash = missed.
 */
import { addDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import type { ScheduleDay } from '@/logic/schedule';
import { EASE_OUT, SPRING_RELEASE } from '@/theme/motion';
import { useTheme } from '@/theme/theme-context';
import { isMistTheme, spacing, TIGHT_FONT_SCALE } from '@/theme/typography';

type Props = {
  weekStart: Date;
  days: ScheduleDay[];
  /** Days with a Quick Log ("2026-11-23"), shown with a small orange dot. */
  loggedKeys?: Set<string>;
  selectedKey: string;
  isCurrentWeek: boolean;
  /** -1 = last change went back a week, 1 = forward (for the slide direction). */
  direction: -1 | 0 | 1;
  onSelect: (day: ScheduleDay) => void;
  onWeek: (delta: -1 | 1) => void;
  onToday: () => void;
};

export function WeekStrip({ weekStart, days, loggedKeys, selectedKey, isCurrentWeek, direction, onSelect, onWeek, onToday }: Props) {
  const { colors, name } = useTheme();
  // Mist & Mint: plain dates (no circles); the selected day is a rounded block.
  const plain = isMistTheme(name);

  const width = useSharedValue(360);
  const x = useSharedValue(0);

  const commit = (delta: -1 | 1) => {
    Haptics.selectionAsync().catch(() => {});
    onWeek(delta);
  };

  // Horizontal swipe = change week. The strip tracks the finger; on release we
  // look at where the flick is heading (position + velocity), not just where it
  // stopped. Taps still reach the day buttons.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.set(e.translationX);
    })
    .onEnd((e) => {
      const projected = e.translationX + e.velocityX * 0.2;
      const w = width.get();
      if (Math.abs(projected) > w * 0.3) {
        const delta = projected < 0 ? 1 : -1;
        // Finish the throw off-screen, then swap in the next week.
        x.set(
          withTiming(-delta * w, { duration: 160, easing: EASE_OUT }, (done) => {
            if (done) scheduleOnRN(commit, delta);
          }),
        );
      } else {
        x.set(withSpring(0, { ...SPRING_RELEASE, velocity: e.velocityX }));
      }
    });

  // A new week arrives from the side it was swiped (or tapped) towards.
  const weekTime = weekStart.getTime();
  useEffect(() => {
    if (direction === 0) return;
    x.set(withSequence(withTiming(direction * width.get(), { duration: 0 }), withSpring(0, SPRING_RELEASE)));
  }, [weekTime, direction, x, width]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View style={{ gap: spacing.sm }}>
      {!isCurrentWeek && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="small" muted style={{ flex: 1 }}>
            {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}
          </AppText>
          <Pressable
            onPress={onToday}
            hitSlop={10}
            accessibilityLabel="Back to this week"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              borderRadius: 999,
              backgroundColor: colors.accent,
            }}>
            <AppText variant="small" color={colors.onAccent}>
              Today
            </AppText>
          </Pressable>
        </View>
      )}

      <GestureDetector gesture={pan}>
      <View style={{ overflow: 'hidden' }} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      <Animated.View style={[{ flexDirection: 'row', justifyContent: 'space-between' }, slide]}>
        {days.map((d) => {
          const selected = d.key === selectedKey;
          return (
            <Pressable
              key={d.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelect(d);
              }}
              accessibilityLabel={`${format(d.date, 'EEEE d MMMM')}, ${d.status}${loggedKeys?.has(d.key) ? ', activity logged' : ''}${d.isToday ? ', today' : ''}`}
              accessibilityState={{ selected }}
              style={{
                alignItems: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: 4,
                borderRadius: plain ? 14 : 999,
                backgroundColor: selected ? colors.accent : 'transparent',
                minWidth: 44,
              }}>
              <AppText variant="small" maxFontSizeMultiplier={TIGHT_FONT_SCALE} color={selected ? colors.onAccent : colors.textMuted}>
                {format(d.date, 'EEE')}
              </AppText>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: plain ? 'transparent' : selected ? colors.cardAlt : colors.card,
                  borderWidth: plain ? (d.isToday && !selected ? 2 : 0) : d.isToday ? 2 : 1,
                  borderColor: d.isToday ? (selected ? colors.onAccent : colors.accent) : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText variant="label" maxFontSizeMultiplier={TIGHT_FONT_SCALE} color={plain && selected ? colors.onAccent : undefined}>
                  {format(d.date, 'd')}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                <Marker status={d.status} onPill={selected} />
                {loggedKeys?.has(d.key) && (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected ? colors.onAccent : colors.accent }} />
                )}
              </View>
            </Pressable>
          );
        })}
      </Animated.View>
      </View>
      </GestureDetector>
    </View>
  );
}

/** Filled = done, outline = planned, red dash = missed, nothing = rest. */
function Marker({ status, onPill }: { status: ScheduleDay['status']; onPill: boolean }) {
  const { colors } = useTheme();
  const ink = onPill ? colors.onAccent : colors.text;
  if (status === 'completed') return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ink }} />;
  if (status === 'planned')
    return <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: ink }} />;
  if (status === 'missed')
    return <View style={{ width: 9, height: 2.5, borderRadius: 2, marginVertical: 2.25, backgroundColor: colors.danger }} />;
  return <View style={{ width: 7, height: 7 }} />;
}
