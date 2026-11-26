/**
 * <MiloPeek />: Milo peeking up from the bottom corner of the workout screen,
 * just his head and shoulders above the edge. He rises into view with a calm
 * spring when the screen appears (a plain fade with Reduce Motion), then
 * keeps his usual blinks and ear flicks. Purely decorative: touches pass through.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Milo } from '@/components/mascot';
import { DURATION, EASE, SPRING, useReducedMotion } from '@/motion';

/** How much of Milo's square stage shows above the edge (head and shoulders). */
export const PEEK_VISIBLE = 0.56;

export function MiloPeek({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const shown = Math.round(size * PEEK_VISIBLE);
  const rise = useSharedValue(0); // 0 = hidden below the edge, 1 = peeking
  useEffect(() => {
    // As the screen fades in, he pops his head up.
    rise.set(reduced ? withTiming(1, { duration: DURATION.micro.base, easing: EASE.out }) : withSpring(1, SPRING.gentle));
    return () => cancelAnimation(rise);
  }, [rise, reduced]);
  const style = useAnimatedStyle(() =>
    reduced ? { opacity: rise.get() } : { transform: [{ translateY: (1 - rise.get()) * shown }] },
  );
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: shown, overflow: 'hidden' }}>
      <Animated.View style={style}>
        <Milo state="sitting" size={size} />
      </Animated.View>
    </View>
  );
}
