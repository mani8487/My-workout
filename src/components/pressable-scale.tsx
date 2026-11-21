/**
 * A Pressable that shrinks slightly (to 97%) the instant a finger lands on it,
 * and springs back on release. Feedback on press-in feels much faster than a
 * fade after the tap.
 *
 * With iPhone's Reduce Motion on, it dims a little instead of shrinking.
 */
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { EASE_OUT } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How small it gets while pressed. Big cards use a gentler 0.98. */
  pressedScale?: number;
};

/** Lets a finger drift a little without cancelling the press. */
const RETENTION = { top: 20, bottom: 20, left: 20, right: 20 };

export function PressableScale({ style, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0); // 0 = resting, 1 = pressed

  const animatedStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - pressed.get() * 0.25 }
      : { transform: [{ scale: 1 - pressed.get() * (1 - pressedScale) }] },
  );

  return (
    <AnimatedPressable
      pressRetentionOffset={RETENTION}
      {...rest}
      onPressIn={(e) => {
        pressed.set(withTiming(1, { duration: 120, easing: EASE_OUT }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withTiming(0, { duration: 150, easing: EASE_OUT }));
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
