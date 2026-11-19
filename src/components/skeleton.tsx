/**
 * Grey placeholder shapes that gently pulse while a screen loads,
 * so the page never flashes empty.
 */
import { useEffect } from 'react';
import { type DimensionValue, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/screen';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export function SkeletonBlock({ width = '100%', height, round }: { width?: DimensionValue; height: number; round?: boolean }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.4 }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.cardAlt }, style]}
    />
  );
}

/** A whole loading screen: title, a large card and a few list rows. */
export function SkeletonScreen({ rows = 4 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={['top']}
      accessibilityLabel="Loading"
      style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <SkeletonBlock width="55%" height={28} />
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          <SkeletonBlock width="40%" height={14} />
          <SkeletonBlock width="75%" height={24} />
          <SkeletonBlock height={48} round />
        </View>
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md }}>
            <SkeletonBlock width={40} height={40} round />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <SkeletonBlock width="60%" height={14} />
              <SkeletonBlock width="35%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
