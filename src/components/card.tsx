import type { ViewProps } from 'react-native';

import { GlassTile } from '@/components/glass-tile';
import { radius, spacing } from '@/theme/typography';

/** A rounded Liquid Glass panel on top of the background. */
export function Card({ style, ...rest }: ViewProps) {
  return <GlassTile style={[{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, style]} {...rest} />;
}
