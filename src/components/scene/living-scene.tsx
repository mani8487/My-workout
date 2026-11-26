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
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
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
import { DURATION, EASE, SPRING, TRIP, useMotionActive, useReducedMotion } from '@/motion';
import { daylight, describeScene, dimness, moodOfStage, sceneTarget, warmth, type Mood } from '@/logic/scene-state';
import { useTheme } from '@/theme/theme-context';

import { roomPalette } from './palette';
import { Curtains, Dust, Floor, Lamp, Plant, Rays, ROOM, RoomWindow, Sill, Veil, WaterGlass } from './room-parts';

/** Share of the screen height the room may use. */
const MAX_HEIGHT_SHARE = 0.34;
/** Milo's square stage in room units, standing on the floor in the middle of the room. */
/** How far (room units) the room drifts up as it leaves for a workout. */
const ROOM_LIFT = 24;
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
  /** The most height the room may take (Home gives it what's left on screen). Defaults to a third of the screen. */
  maxHeight?: number;
  /** Where the catch-up starts. Only read when the scene first appears. */
  from?: { stage: number; water: number };
  /** Scene Lab: show this Milo state instead of the mood (bump cue to replay). */
  miloOverride?: MiloState | null;
  /** Bump to leave for a workout: Milo hops off toward you and the room eases up and out. */
  departCue?: number;
  /** Called when it's time to open the workout screen. Not called if the room leaves the screen first
   *  (a tab switch, the app going to the background): the trip is then abandoned. */
  onDeparted?: () => void;
  /** The start move was cut short (the app went to the background, or a tab switch) and the room is
   *  back on screen: Home should bring the room back (bump arriveCue) and unlock. */
  onAbandoned?: () => void;
  /** Bump when back on Home after leaving: the room eases back and Milo hops into his spot. */
  arriveCue?: number;
  /** Milo wears his towel (a workout is done today). */
  towel?: boolean;
  miloCue?: number;
};

export const LivingScene = memo(function LivingScene({ activeMinutes, goalMinutes, waterMl, waterGoalMl, hour, maxHeight, from, miloOverride, miloCue = 0, departCue = 0, onDeparted, onAbandoned, arriveCue = 0, towel = false }: Props) {
  const { width, height } = useWindowDimensions();
  const { isDark, colors } = useTheme();
  const palette = roomPalette(isDark);
  const reduced = useReducedMotion();
  const onScreen = useMotionActive();
  const live = onScreen && !reduced;
  const k = Math.min(width / ROOM.w, (maxHeight ?? height * MAX_HEIGHT_SHARE) / ROOM.h);
  // When the space changes size (a card below grows or shrinks), the room is laid out at the new
  // size at once, then scaled from its old size to the new one with a spring, from the floor up.
  const fit = useSharedValue(1);
  const lastK = useRef(k);
  useLayoutEffect(() => {
    const before = lastK.current;
    lastK.current = k;
    if (before === k || reduced) return;
    // Start from what's on screen now (a second resize mid-spring continues smoothly).
    fit.set(fit.get() * (before / k));
    fit.set(withSpring(1, SPRING.gentle));
  }, [k, fit, reduced]);

  const target = sceneTarget({ activeMinutes, goalMinutes, waterMl, waterGoalMl });
  const [start] = useState(() => from ?? { stage: target.stage, water: target.water });

  const stage = useSharedValue(start.stage);
  const level = useSharedValue(start.water);
  const day = useSharedValue(daylight(hour));
  const fade = useSharedValue(1); // Reduce Motion: the room dips to swap states unseen
  const cool = useDerivedValue(() => dimness(stage.get()));
  const warm = useDerivedValue(() => warmth(stage.get()));
  const trip = useSharedValue(0); // 0 = the room is here, 1 = it has eased up and out (off to a workout)
  useEffect(() => () => [stage, level, day, fade, fit, trip].forEach((v) => cancelAnimation(v)), [stage, level, day, fade, fit, trip]);

  // ----- leaving for a workout, and coming back -----
  type Travel = 'none' | 'departing' | 'arriving';
  const [travel, setTravel] = useState<Travel>('none');
  const [seen, setSeen] = useState({ departCue, arriveCue });
  // Cues already given when the room appeared (it was rebuilt, e.g. after a theme change) never replay.
  const [initialCues] = useState({ departCue, arriveCue });
  if (seen.departCue !== departCue || seen.arriveCue !== arriveCue) {
    setSeen({ departCue, arriveCue });
    if (seen.departCue !== departCue && departCue) setTravel('departing');
    else if (seen.arriveCue !== arriveCue && arriveCue) setTravel('arriving');
  }
  const departedRef = useRef(onDeparted);
  const abandonedRef = useRef(onAbandoned);
  useEffect(() => {
    departedRef.current = onDeparted;
    abandonedRef.current = onAbandoned;
  }, [onDeparted, onAbandoned]);
  useEffect(() => {
    if (!departCue || departCue === initialCues.departCue) return;
    // Milo goes first (perk, crouch, hop); the room follows him out as he lands. With Reduce Motion, a plain fade.
    trip.set(
      withDelay(
        reduced ? 0 : TRIP.roomOut,
        withTiming(1, { duration: reduced ? DURATION.micro.base : DURATION.transition.short, easing: EASE.inOut, reduceMotion: NEVER }),
        NEVER,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departCue]);
  // Open the workout screen on time, unless the room left the screen first (then the trip is abandoned
  // and the return plays when Home is back).
  const opened = useRef(initialCues.departCue);
  const abandoned = useRef(0);
  useEffect(() => {
    // Back on screen after an abandoned trip: hand it back to Home, which brings the room back.
    if (onScreen && abandoned.current) {
      abandoned.current = 0;
      abandonedRef.current?.();
    }
    if (!departCue || opened.current === departCue) return;
    if (!onScreen) {
      opened.current = departCue;
      abandoned.current = departCue;
      return;
    }
    const t = setTimeout(
      () => {
        opened.current = departCue;
        departedRef.current?.();
      },
      reduced ? DURATION.micro.base : TRIP.navigate,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departCue, onScreen]);
  useEffect(() => {
    if (!arriveCue || arriveCue === initialCues.arriveCue) return;
    trip.set(withTiming(0, { duration: reduced ? DURATION.micro.base : DURATION.transition.base, easing: EASE.out, reduceMotion: NEVER }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arriveCue]);

  // ----- the room follows today's numbers -----
  const first = useRef(true);
  useEffect(() => {
    // While covered (a sheet, another screen, the background), hold the old room; the change
    // plays when the room is back in view, so you see it happen.
    if (!onScreen) return;
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
  }, [target.stage, target.water, reduced, onScreen, stage, level, fade]);

  useEffect(() => {
    day.set(withTiming(daylight(hour), { duration: DURATION.transition.long, easing: EASE.inOut }));
  }, [hour, day]);

  // ----- Milo follows the mood; getting up uses his full waking move -----
  const [milo, setMilo] = useState<MiloState>(() => moodOfStage(start.stage));
  const moodRef = useRef<Mood>(target.mood);
  const firstMood = useRef(true);
  useEffect(() => {
    moodRef.current = target.mood;
    // While the Lab overrides Milo, track the mood directly (no waking move would play to finish it).
    if (!onScreen) return; // Milo too waits until the room is in view
    const go = () =>
      setMilo((cur) => (!miloOverride && upright(target.mood) && (lyingDown(cur) || cur === 'waking') ? 'waking' : target.mood));
    // During the first catch-up, Milo moves when the room starts to.
    const wait = firstMood.current ? DURATION.micro.slow : 0;
    firstMood.current = false;
    const t = setTimeout(go, wait);
    return () => clearTimeout(t);
  }, [target.mood, miloOverride, onScreen]);
  const onSettled = (s: MiloState) => {
    if (s === 'waking') setMilo(moodRef.current);
    if (s === 'arriving') setTravel('none');
  };

  const roomStyle = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - trip.get()),
    transform: [{ translateY: -trip.get() * ROOM_LIFT * k }, { scale: fit.get() }],
  }));
  const stageW = ROOM.w * k;
  const stageStyle = { position: 'absolute' as const, left: (width - stageW) / 2, top: 0, width: stageW, height: ROOM.h * k };
  const shown = miloOverride ?? (travel === 'none' ? milo : travel);

  return (
    <Animated.View
      // While the room is away (off to a workout) it isn't read out.
      accessible={travel !== 'departing'}
      accessibilityElementsHidden={travel === 'departing'}
      accessibilityRole="image"
      accessibilityLabel={describeScene(activeMinutes, goalMinutes)}
      style={[{ width, height: ROOM.h * k, transformOrigin: 'bottom' }, roomStyle]}>
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
          towel={towel}
          size={MILO.size * k}
          style={{ position: 'absolute', left: (MILO.centerX - MILO.size / 2) * k, top: (ROOM.floorY - MILO.groundInStage) * k }}
        />
      </View>
      <Veil opacity={cool} color={palette.coolVeil} />
      <Veil opacity={warm} color={palette.warmVeil} />
      <View pointerEvents="none" style={stageStyle}>
        <Rays k={k} stage={stage} day={day} palette={palette} />
        <Dust k={k} live={live} reduced={reduced} stage={stage} palette={palette} />
      </View>
    </Animated.View>
  );
});
