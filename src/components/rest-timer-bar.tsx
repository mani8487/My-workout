/**
 * Rest timer strip: a thin brass ring that drains, the countdown, +30s and Skip.
 * Never blocks the screen. A soft haptic and a gentle pulse when it ends.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { ProgressRing } from '@/components/progress-ring';
import { useRestTimer } from '@/logic/rest-timer';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

function mmss(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RestTimerBar() {
  const { colors } = useTheme();
  const { remainingMs, totalMs, addSeconds, skip } = useRestTimer();

  // Buzz once when a running timer reaches zero while the app is open.
  const wasRunning = useRef(false);
  useEffect(() => {
    // Only counts as "ended" if it ran down to the last second (not when you tap Skip early).
    if (remainingMs != null) wasRunning.current = remainingMs <= 1000;
    if (remainingMs == null && wasRunning.current) {
      wasRunning.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [remainingMs]);

  if (remainingMs == null) return null;
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(250)}
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}>
      <ProgressRing size={56} stroke={3} fraction={fraction}>
        <AppText variant="label">{mmss(remainingMs)}</AppText>
      </ProgressRing>
      <AppText variant="small" muted style={{ flex: 1 }}>
        Rest
      </AppText>
      <TimerButton label="+30s" onPress={() => addSeconds(30)} />
      <TimerButton label="Skip" onPress={() => skip()} />
    </Animated.View>
  );
}

function TimerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: MIN_TAP,
        minWidth: 64,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      <AppText variant="label" color={colors.accent}>
        {label}
      </AppText>
    </Pressable>
  );
}
