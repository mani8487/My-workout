import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

/**
 * The standard scrolling page used by every tab.
 * It automatically keeps content clear of the iPhone's notch and the tab bar.
 */
export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      {children}
    </ScrollView>
  );
}
