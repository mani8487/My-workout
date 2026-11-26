/** A checkmark that draws itself (left stroke, then right) when `done` turns on. */
import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { EASE } from '@/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Path length of the tick below (two strokes), measured in a 24×24 box.
const LENGTH = 20;

export function AnimatedTick({ done, color, idleColor, size = 20 }: { done: boolean; color: string; idleColor: string; size?: number }) {
  const progress = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    progress.value = done ? withTiming(1, { duration: 260, easing: EASE.out }) : withTiming(0, { duration: 120, easing: EASE.out });
  }, [done, progress]);

  const drawn = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - progress.value) }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Faint outline tick, so an un-ticked box still shows what it does. */}
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={idleColor} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <AnimatedPath
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${LENGTH} ${LENGTH}`}
        animatedProps={drawn}
      />
    </Svg>
  );
}
