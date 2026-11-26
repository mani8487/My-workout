/**
 * <MiloLine />: Milo's one status line under the room. When the line changes,
 * the old one fades out while the new one fades in over it (a gentle
 * cross-fade, kept even with Reduce Motion since nothing moves).
 */
import { useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { DURATION, EASE } from '@/motion';

export function MiloLine({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Animated.View
      key={text}
      entering={FadeIn.duration(DURATION.transition.base).easing(EASE.inOut).reduceMotion(ReduceMotion.Never)}
      exiting={FadeOut.duration(DURATION.micro.slow).easing(EASE.out).reduceMotion(ReduceMotion.Never)}>
      {/* Up to 60 characters: one line (shrinking slightly if needed), two with large text. */}
      <AppText
        variant="small"
        accessibilityLiveRegion="polite"
        numberOfLines={fontScale > 1.2 ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ textAlign: 'center' }}>
        {text}
      </AppText>
    </Animated.View>
  );
}
