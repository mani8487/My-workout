/** A thin ring that fills (or drains) to show progress, with optional content in the middle. Animates when `fraction` changes. */
import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/theme-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  size,
  stroke = 4,
  fraction,
  children,
}: {
  size: number;
  stroke?: number;
  /** 0 to 1. */
  fraction: number;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));

  // Starts empty and sweeps to the value on first show, then glides between values.
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(f, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [f, shown]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - shown.value) }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.inputBorder} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
          // Start at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
