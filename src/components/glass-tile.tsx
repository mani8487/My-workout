/**
 * Mist & Mint tiles are made of iOS "Liquid Glass" (the same material as
 * Instagram's "Story saved" pill): see-through, softly blurred, with a bright
 * thin rim, so a tile looks like part of the screen instead of a box on top.
 *
 * On iPhones without Liquid Glass (before iOS 26) it falls back to a
 * translucent surface with the same rim.
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';

const HAS_GLASS = isLiquidGlassAvailable();

export function GlassTile({ style, children, ...rest }: ViewProps) {
  const { isDark } = useTheme();
  const rim = isDark ? 'rgba(241,244,248,0.12)' : 'rgba(255,255,255,0.85)';

  if (HAS_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        // A whisper of surface colour keeps text readable over busy backgrounds.
        tintColor={isDark ? 'rgba(34,45,59,0.35)' : 'rgba(255,255,255,0.35)'}
        style={[{ overflow: 'hidden', borderWidth: 1, borderColor: rim }, style]}
        {...rest}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: rim,
          backgroundColor: isDark ? 'rgba(34,45,59,0.72)' : 'rgba(255,255,255,0.72)',
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}
