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
import type { MiloState, MiloWater } from './types';

const DESCRIPTION: Record<MiloState, string> = {
  sleeping: 'Milo the cat is asleep on his couch',
  waking: 'Milo the cat is waking up',
  stirring: 'Milo the cat is stirring on his couch',
  sitting: 'Milo the cat is sitting',
  content: 'Milo the cat sits contentedly',
  reacting: 'Milo the cat raises a paw',
  celebrating: 'Milo the cat jumps for joy',
  drinking: 'Milo the cat is drinking water',
  departing: 'Milo the cat hops off to join your workout',
  arriving: 'Milo the cat hops back to his couch',
  'cameo-stretch': 'Milo the cat stretches',
  'cameo-walk': 'Milo the cat walks on the spot',
  'cameo-run': 'Milo the cat runs on the spot',
  'cameo-squat': 'Milo the cat does squats',
  striding: 'Milo the cat trots or runs along with you',
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
  /** Wears his towel (after a workout today). */
  towel?: boolean;
  /** Water inside him (Home). Leave out for the usual Milo. */
  water?: MiloWater;
  /** Milo Steps: the gait while striding (0 still, 1 trot, 2 run) and his energy (0–1). */
  gait?: number;
  energy?: number;
  style?: StyleProp<ViewStyle>;
};

export function Milo({ state, size = 160, cue = 0, onSettled, onPress, keepCouch = false, towel = false, water, gait, energy, style }: Props) {
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
        towel={towel}
        water={water}
        gait={gait}
        energy={energy}
        onSettled={handleSettled}
      />
    </Pressable>
  );
}
