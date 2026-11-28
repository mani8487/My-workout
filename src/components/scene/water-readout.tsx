/**
 * The small "1.2 / 2.4 L" over Milo's head while there's water in him. Tap it
 * for the water pop-up. Sits in the room's coordinates, measured from the
 * bottom of the room (the room is laid out at the bottom of its space).
 */
import { SymbolView } from 'expo-symbols';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { MILO_ART } from '@/components/mascot/palette';
import { DURATION } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

import { ROOM } from './room-parts';

const litres = (ml: number) => (ml / 1000).toFixed(1).replace(/\.0$/, '');
/** Centre of the readout in room units: above Milo's ears. */
const AT = { x: 180, y: 38 };
const BOX_W = 120;

type Props = {
  ml: number;
  goal: number;
  k: number;
  /** The room's own fade and lift (leaving for a workout), so the readout goes with it. */
  away: SharedValue<number>;
  fade: SharedValue<number>;
  lift: number;
  onPress?: () => void;
};

export function WaterReadout({ ml, goal, k, away, fade, lift, onPress }: Props) {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - away.get()),
    transform: [{ translateY: -away.get() * lift * k }],
  }));
  const left = (width - ROOM.w * k) / 2 + (AT.x - BOX_W / 2) * k;
  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.transition.short)}
      exiting={FadeOut.duration(DURATION.micro.base)}
      style={[{ position: 'absolute', left, width: BOX_W * k, bottom: (ROOM.h - AT.y) * k - MIN_TAP / 2, alignItems: 'center' }, style]}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`Water: ${litres(ml)} of ${litres(goal)} litres`}
        accessibilityHint="Opens water"
        style={{ minHeight: MIN_TAP, justifyContent: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(241,244,248,0.12)' : 'rgba(255,255,255,0.85)',
            backgroundColor: isDark ? 'rgba(34,45,59,0.72)' : 'rgba(255,255,255,0.72)',
          }}>
          <SymbolView name="drop.fill" size={11} tintColor={MILO_ART.liquid} />
          <AppText variant="small" color={colors.text} maxFontSizeMultiplier={1.3}>
            {litres(ml)} / {litres(goal)} L
          </AppText>
        </View>
      </PressableScale>
    </Animated.View>
  );
}
