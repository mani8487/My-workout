/** The rest timer strip: countdown, progress, +30s and Skip. Never blocks the screen. */
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useRestTimer } from '@/logic/rest-timer';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

function mmss(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RestTimerBar() {
  const { colors } = useTheme();
  const { remainingMs, totalMs, addSeconds, skip } = useRestTimer();
  if (remainingMs == null) return null;

  const fraction = totalMs > 0 ? remainingMs / totalMs : 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.accentSoft,
        gap: spacing.sm,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="small" muted>
            Rest
          </AppText>
          <AppText variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {mmss(remainingMs)}
          </AppText>
        </View>
        <TimerButton label="+30s" onPress={() => addSeconds(30)} />
        <TimerButton label="Skip" onPress={skip} />
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.card, overflow: 'hidden' }}>
        <View style={{ width: `${fraction * 100}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
    </Animated.View>
  );
}

function TimerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.sm,
        backgroundColor: colors.card,
        opacity: pressed ? 0.7 : 1,
      })}>
      <AppText variant="label" color={colors.accent}>
        {label}
      </AppText>
    </Pressable>
  );
}
