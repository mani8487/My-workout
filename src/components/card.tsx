import { View, type ViewProps } from 'react-native';

import { GlassTile } from '@/components/glass-tile';
import { useTheme } from '@/theme/theme-context';
import { isMistTheme, radius, spacing } from '@/theme/typography';

/** A rounded panel on top of the background (a Liquid Glass tile in Mist & Mint). */
export function Card({ style, ...rest }: ViewProps) {
  const { colors, name } = useTheme();
  if (isMistTheme(name)) {
    return <GlassTile style={[{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, style]} {...rest} />;
  }
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
