import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

/** A rounded panel on top of the background. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}
