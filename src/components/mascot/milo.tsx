/**
 * <Milo />: the only mascot component screens use.
 *
 *   const milo = useMiloState('sleeping');
 *   <Milo {...milo.props} size={180} />
 *   milo.wake(); milo.react(); milo.celebrate(); milo.drink(); milo.sit(); milo.sleep();
 *
 * Milo pauses his idle motion when the screen is hidden or the app is in the
 * background, shows still poses when Reduce Motion is on, and reacts to taps
 * with a head turn or ear twitch plus a light haptic.
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useMotionActive, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme/theme-context';

import { ActiveMiloRenderer } from './renderer';
import type { MiloState } from './types';

const DESCRIPTION: Record<MiloState, string> = {
  sleeping: 'Milo the cat is asleep on his couch',
  waking: 'Milo the cat is waking up',
  stirring: 'Milo the cat is stirring on his couch',
  sitting: 'Milo the cat is sitting',
  content: 'Milo the cat sits contentedly',
  reacting: 'Milo the cat raises a paw',
  celebrating: 'Milo the cat jumps for joy',
  drinking: 'Milo the cat is drinking water',
};

type Props = {
  state: MiloState;
  /** Width and height in points (Milo is square). */
  size?: number;
  /** Bump to replay a one-shot (reacting, celebrating). useMiloState handles this. */
  cue?: number;
  onSettled?: (state: MiloState) => void;
  onPress?: () => void;
  /** Keep the couch when Milo gets up (the Living Home room). */
  keepCouch?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Milo({ state, size = 160, cue = 0, onSettled, onPress, keepCouch = false, style }: Props) {
  const reducedMotion = useReducedMotion();
  const { isDark } = useTheme();
  const onScreen = useMotionActive();
  const [tapSignal, setTapSignal] = useState(0);
  const Renderer = ActiveMiloRenderer;
  // A stable callback, so the (memoised) renderer doesn't re-render each time Milo's parent does.
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);
  const handleSettled = useCallback((s: MiloState) => settledRef.current?.(s), []);

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={DESCRIPTION[state]}
      accessibilityHint="Pets Milo"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setTapSignal((n) => n + 1);
        onPress?.();
      }}
      style={[{ width: size, height: size }, style]}>
      <Renderer
        state={state}
        size={size}
        cue={cue}
        tapSignal={tapSignal}
        paused={!onScreen}
        reducedMotion={reducedMotion}
        isDark={isDark}
        keepCouch={keepCouch}
        onSettled={handleSettled}
      />
    </Pressable>
  );
}
