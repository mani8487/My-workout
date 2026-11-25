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
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-context';

import { ActiveMiloRenderer } from './renderer';
import type { MiloState } from './types';

const DESCRIPTION: Record<MiloState, string> = {
  sleeping: 'Milo the cat is asleep on his couch',
  waking: 'Milo the cat is waking up',
  sitting: 'Milo the cat is sitting',
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
  style?: StyleProp<ViewStyle>;
};

/** True while this screen is focused and the app is in the foreground. */
function useOnScreen() {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && active;
}

export function Milo({ state, size = 160, cue = 0, onSettled, onPress, style }: Props) {
  const reducedMotion = useReducedMotion();
  const { isDark } = useTheme();
  const onScreen = useOnScreen();
  const [tapSignal, setTapSignal] = useState(0);
  const Renderer = ActiveMiloRenderer;

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
        onSettled={(s) => onSettled?.(s)}
      />
    </Pressable>
  );
}
