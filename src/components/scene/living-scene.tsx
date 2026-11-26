/**
 * <LivingScene />: the Living Home room. The room itself shows today's
 * progress (see logic/scene-state.ts): light, curtains, lamp, dust and Milo's
 * mood follow active minutes; the glass on the sill follows water.
 *
 * Changes never snap: `stage` and `level` spring from the old value to the new
 * one on the UI thread. On mount, the room catches up from `from` (what was on
 * screen last time today) to now. Milo wakes with his full waking move when
 * the room passes "awake", and lies back down if it goes the other way.
 * With Reduce Motion on, the room cross-fades between still states.
 */
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Milo, type MiloState } from '@/components/mascot';
import { DURATION, EASE, SPRING, useMotionActive, useReducedMotion } from '@/motion';
import { daylight, describeScene, dimness, moodOfStage, sceneTarget, warmth, type Mood } from '@/logic/scene-state';
import { useTheme } from '@/theme/theme-context';

import { roomPalette } from './palette';
import { Curtains, Dust, Floor, Lamp, Plant, Rays, ROOM, RoomWindow, Sill, Veil, WaterGlass } from './room-parts';

/** Share of the screen height the room may use. */
const MAX_HEIGHT_SHARE = 0.34;
/** Milo's square stage in room units, standing on the floor in the middle of the room. */
const MILO = { size: 200, centerX: 180, groundInStage: (208 / 240) * 200 };

const lyingDown = (s: MiloState) => s === 'sleeping' || s === 'stirring';
const upright = (m: Mood) => m === 'sitting' || m === 'content';
const NEVER = ReduceMotion.Never;

type Props = {
  activeMinutes: number;
  goalMinutes: number;
  waterMl: number;
  waterGoalMl: number;
  /** Local hour (fractions allowed): sets the sky outside the window. */
  hour: number;
  /** Where the catch-up starts. Only read when the scene first appears. */
  from?: { stage: number; water: number };
  /** Scene Lab: show this Milo state instead of the mood (bump cue to replay). */
  miloOverride?: MiloState | null;
  miloCue?: number;
};

export function LivingScene({ activeMinutes, goalMinutes, waterMl, waterGoalMl, hour, from, miloOverride, miloCue = 0 }: Props) {
  const { width, height } = useWindowDimensions();
  const k = Math.min(width / ROOM.w, (height * MAX_HEIGHT_SHARE) / ROOM.h);
  const { isDark, colors } = useTheme();
  const palette = roomPalette(isDark);
  const reduced = useReducedMotion();
  const live = useMotionActive() && !reduced;

  const target = sceneTarget({ activeMinutes, goalMinutes, waterMl, waterGoalMl });
  const [start] = useState(() => from ?? { stage: target.stage, water: target.water });

  const stage = useSharedValue(start.stage);
  const level = useSharedValue(start.water);
  const day = useSharedValue(daylight(hour));
  const fade = useSharedValue(1); // Reduce Motion: the room dips to swap states unseen
  const cool = useDerivedValue(() => dimness(stage.get()));
  const warm = useDerivedValue(() => warmth(stage.get()));

  // ----- the room follows today's numbers -----
  const first = useRef(true);
  useEffect(() => {
    const catchUp = first.current;
    first.current = false;
    if (reduced) {
      if (Math.abs(stage.get() - target.stage) < 0.001 && Math.abs(level.get() - target.water) < 0.001) return;
      // These fades are the Reduce Motion alternative, so they always play (ReduceMotion.Never).
      fade.set(
        withSequence(
          NEVER,
          withTiming(0, { duration: DURATION.micro.fast, easing: EASE.out, reduceMotion: NEVER }),
          withTiming(1, { duration: DURATION.micro.base, easing: EASE.inOut, reduceMotion: NEVER }),
        ),
      );
      const swap = (to: number) => withDelay(DURATION.micro.fast, withTiming(to, { duration: 0, reduceMotion: NEVER }), NEVER);
      stage.set(swap(target.stage));
      level.set(swap(target.water));
      return;
    }
    if (catchUp) {
      // Coming back: a short, calm catch-up from what you last saw.
      const ease = { duration: DURATION.transition.long, easing: EASE.inOut };
      stage.set(withDelay(DURATION.micro.slow, withTiming(target.stage, ease)));
      level.set(withDelay(DURATION.micro.slow + DURATION.micro.fast, withTiming(target.water, ease)));
    } else {
      stage.set(withSpring(target.stage, SPRING.gentle));
      level.set(withDelay(DURATION.micro.fast, withSpring(target.water, SPRING.gentle)));
    }
  }, [target.stage, target.water, reduced, stage, level, fade]);

  useEffect(() => {
    day.set(withTiming(daylight(hour), { duration: DURATION.transition.long, easing: EASE.inOut }));
  }, [hour, day]);

  // ----- Milo follows the mood; getting up uses his full waking move -----
  const [milo, setMilo] = useState<MiloState>(() => moodOfStage(start.stage));
  const moodRef = useRef<Mood>(target.mood);
  const firstMood = useRef(true);
  useEffect(() => {
    moodRef.current = target.mood;
    const go = () => setMilo((cur) => (upright(target.mood) && (lyingDown(cur) || cur === 'waking') ? 'waking' : target.mood));
    // During the first catch-up, Milo moves when the room starts to.
    const wait = firstMood.current ? DURATION.micro.slow : 0;
    firstMood.current = false;
    const t = setTimeout(go, wait);
    return () => clearTimeout(t);
  }, [target.mood]);
  const onSettled = (s: MiloState) => {
    if (s === 'waking') setMilo(moodRef.current);
  };

  const roomStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const stageW = ROOM.w * k;
  const stageStyle = { position: 'absolute' as const, left: (width - stageW) / 2, top: 0, width: stageW, height: ROOM.h * k };
  const shown = miloOverride ?? milo;

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={describeScene(activeMinutes, goalMinutes)}
      style={[{ width, height: ROOM.h * k }, roomStyle]}>
      <Floor k={k} palette={palette} />
      <View style={stageStyle}>
        <RoomWindow k={k} day={day} palette={palette} />
        <Curtains k={k} live={live} stage={stage} palette={palette} />
        <Sill k={k} palette={palette} />
        <WaterGlass k={k} level={level} water={colors.water} palette={palette} />
        <Plant k={k} live={live} palette={palette} />
        <Lamp k={k} live={live} stage={stage} day={day} palette={palette} />
        <Milo
          state={shown}
          cue={miloCue}
          onSettled={onSettled}
          keepCouch
          size={MILO.size * k}
          style={{ position: 'absolute', left: (MILO.centerX - MILO.size / 2) * k, top: (ROOM.floorY - MILO.groundInStage) * k }}
        />
      </View>
      <Veil opacity={cool} color={palette.coolVeil} />
      <Veil opacity={warm} color={palette.warmVeil} />
      <View pointerEvents="none" style={stageStyle}>
        <Rays k={k} stage={stage} day={day} palette={palette} />
        <Dust k={k} live={live} stage={stage} palette={palette} />
      </View>
    </Animated.View>
  );
}
