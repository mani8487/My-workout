/**
 * The Mon–Sun strip on Home.
 * - Tap a day to select it (dark pill). Today has a ring around its date.
 * - Swipe left/right to move a week at a time; "Today" jumps back.
 * - Marker under each date: filled = done, outline = planned,
 *   none = rest, small red dash = missed.
 */
import { addDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import type { ScheduleDay } from '@/logic/schedule';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type Props = {
  weekStart: Date;
  days: ScheduleDay[];
  selectedKey: string;
  isCurrentWeek: boolean;
  /** -1 = last change went back a week, 1 = forward (for the slide direction). */
  direction: -1 | 0 | 1;
  onSelect: (day: ScheduleDay) => void;
  onWeek: (delta: -1 | 1) => void;
  onToday: () => void;
};

export function WeekStrip({ weekStart, days, selectedKey, isCurrentWeek, direction, onSelect, onWeek, onToday }: Props) {
  const { colors } = useTheme();

  // Horizontal swipe = change week. Taps still reach the day buttons.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -50) onWeek(1);
          else if (g.dx >= 50) onWeek(-1);
        },
      }),
    [onWeek],
  );

  const entering =
    direction > 0 ? SlideInRight.duration(220) : direction < 0 ? SlideInLeft.duration(220) : FadeIn.duration(150);

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

      <Animated.View
        key={weekStart.toISOString()}
        entering={entering}
        {...pan.panHandlers}
        style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const selected = d.key === selectedKey;
          return (
            <Pressable
              key={d.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelect(d);
              }}
              accessibilityLabel={`${format(d.date, 'EEEE d MMMM')}, ${d.status}${d.isToday ? ', today' : ''}`}
              accessibilityState={{ selected }}
              style={{
                alignItems: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: 4,
                borderRadius: 999,
                backgroundColor: selected ? colors.accent : 'transparent',
                minWidth: 44,
              }}>
              <AppText variant="small" color={selected ? colors.onAccent : colors.textMuted}>
                {format(d.date, 'EEE')}
              </AppText>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: selected ? colors.cardAlt : colors.card,
                  borderWidth: d.isToday ? 2 : 1,
                  borderColor: d.isToday ? (selected ? colors.onAccent : colors.accent) : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText variant="label">{format(d.date, 'd')}</AppText>
              </View>
              <Marker status={d.status} onPill={selected} />
            </Pressable>
          );
        })}
      </Animated.View>
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
