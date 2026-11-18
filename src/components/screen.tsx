import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

/** The theme's background: a soft gradient in Frost, a flat colour otherwise. */
export function Backdrop() {
  const { colors } = useTheme();
  if (!colors.backgroundGradient) return null;
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
      <Backdrop />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {children}
      </ScrollView>
    </View>
  );
}
