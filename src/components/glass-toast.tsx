/**
 * A small frosted-glass pill that floats in for a moment ("Set saved"), like
 * iOS's own confirmations: no dimming, no modal, never blocks a tap.
 * Show it by changing `signal` (e.g. a counter).
 */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { DURATION, EASE } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

const SHOW_MS = 1600;

export function GlassToast({ signal, message, icon = 'checkmark.circle.fill' }: { signal: number; message: string; icon?: SFSymbol }) {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (signal === 0) return;
    // Deliberate: each new signal shows the pill again.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    AccessibilityInfo.announceForAccessibility(message);
    const id = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [signal, message]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: spacing.sm, alignItems: 'center' }}>
      {visible && (
        <Animated.View
          key={signal}
          entering={FadeInDown.duration(DURATION.micro.slow).easing(EASE.out).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(DURATION.micro.base)}>
          <GlassTile
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              minHeight: 44,
              paddingHorizontal: spacing.lg,
              borderRadius: 999,
            }}>
            <SymbolView name={icon} size={18} tintColor={isDark ? colors.success : '#3F8F7A'} />
            <AppText variant="label">{message}</AppText>
          </GlassTile>
        </Animated.View>
      )}
    </View>
  );
}
