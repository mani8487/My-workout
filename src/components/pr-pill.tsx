/**
 * The one SOLID accent element in the app, so a record feels special:
 * a pill with a trophy and WEIGHT PR / REP PR, with a single soft shimmer
 * the first time it appears.
 */
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export function PrPill({ kind, shimmer = false }: { kind: 'weight' | 'reps'; shimmer?: boolean }) {
  const { colors } = useTheme();
  const x = useSharedValue(-1);

  useEffect(() => {
    if (shimmer) x.value = withDelay(250, withTiming(1, { duration: 900 }));
  }, [shimmer, x]);

  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 120 }, { rotate: '20deg' }],
    opacity: x.value > -1 && x.value < 1 ? 0.35 : 0,
  }));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 1,
        borderRadius: radius.pill,
        overflow: 'hidden',
      }}>
      <SymbolView name="trophy.fill" size={12} tintColor={colors.onAccent} />
      <AppText variant="small" color={colors.onAccent} style={{ fontWeight: '700', letterSpacing: 0.4 }}>
        {kind === 'weight' ? 'WEIGHT PR' : 'REP PR'}
      </AppText>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: -10, bottom: -10, width: 24, backgroundColor: '#FFFFFF' }, sheen]}
      />
    </View>
  );
}
