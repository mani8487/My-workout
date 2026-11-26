/**
 * The water droplet in the top row: a live gauge. The droplet fills with aqua
 * as you drink, and a thin ring around it shows progress toward today's goal.
 */
import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { PressableScale } from '@/components/pressable-scale';
import { SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 44;
const RING_R = 20;
const RING = 2 * Math.PI * RING_R;
// Droplet drawn in a 24 x 24 box: top tip at y 2.5, bottom of the bulb at y 21.6.
const DROP = 'M12 2.5 C12 2.5 5 10.4 5 14.6 A7 7 0 0 0 19 14.6 C19 10.4 12 2.5 12 2.5 Z';
const DROP_TOP = 2.5;
const DROP_BOTTOM = 21.6;

type Props = {
  ml: number;
  goal: number;
  onPress: () => void;
  onLongPress?: () => void;
};

export function WaterGauge({ ml, goal, onPress, onLongPress }: Props) {
  const { colors } = useTheme();
  const clipId = `drop${useId().replace(/:/g, '')}`;
  const target = goal > 0 ? Math.min(1, ml / goal) : 0;
  const level = useSharedValue(target);

  useEffect(() => {
    level.set(withSpring(target, SPRING.soft));
  }, [level, target]);

  const waterProps = useAnimatedProps(() => {
    // Any water at all shows at least a thin layer, so the gauge never looks broken.
    const l = level.get();
    const shown = l <= 0 ? 0 : 0.12 + l * 0.88;
    return { y: DROP_BOTTOM - shown * (DROP_BOTTOM - DROP_TOP) };
  });
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - level.get()) }));

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Water: ${ml.toLocaleString()} of ${goal.toLocaleString()} millilitres`}
      accessibilityHint={onLongPress ? 'Opens water. Long-press logs your last amount.' : 'Opens water'}
      style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RING_R} stroke={colors.accentSoft} strokeWidth={2} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RING_R}
          stroke={colors.water}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING} ${RING}`}
          animatedProps={ringProps}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', left: (SIZE - 24) / 2, top: (SIZE - 24) / 2 }}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Defs>
            <ClipPath id={clipId}>
              <Path d={DROP} />
            </ClipPath>
          </Defs>
          <AnimatedRect x={0} width={24} height={24} fill={colors.water} clipPath={`url(#${clipId})`} animatedProps={waterProps} />
          <Path d={DROP} stroke={colors.text} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </Svg>
      </View>
    </PressableScale>
  );
}
