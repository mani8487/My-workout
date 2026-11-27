import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

/** The screen background: a soft mist-to-mint gradient. */
export function Backdrop() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}

/**
 * The standard scrolling page used by every tab.
 * It automatically keeps content clear of the iPhone's notch and the tab bar.
 */
export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The scroll view must come first: iOS only keeps the first one clear of
          the clock and tab bar. The gradient sits behind it via zIndex. */}
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {children}
      </ScrollView>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} pointerEvents="none">
        <Backdrop />
      </View>
    </View>
  );
}
