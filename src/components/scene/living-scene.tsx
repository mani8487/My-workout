/**
 * <LivingScene />: the Living Home room. The room itself shows today's
 * progress (see logic/scene-state.ts): light, curtains, lamp, dust and Milo's
 * mood follow active minutes; water shows inside Milo.
 *
 * Changes never snap: `stage` springs from the old value to the new
 * one on the UI thread. On mount, the room catches up from `from` (what was on
 * screen last time today) to now. Milo wakes with his full waking move when
 * the room passes "awake", and lies back down if it goes the other way.
 * With Reduce Motion on, the room cross-fades between still states.
 *
 * Milo Steps (`steps`): Milo trots or runs on the spot while you walk or run,
 * replays what you did since you last looked, and celebrates step milestones.
 * Steps never change the room itself.
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';
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

import { Milo, type MiloState, type MiloWater } from '@/components/mascot';
import { CAMEO, DURATION, EASE, SPRING, STRIDE, TRIP, WATER, useMotionActive, useReducedMotion } from '@/motion';
import { enqueueCameos, type CameoKind } from '@/logic/cameo';
import { fillLevel } from '@/logic/hydration-layers';
import { gaitLevel, type ReplayPart } from '@/logic/milo-steps';
import { daylight, describeScene, dimness, moodOfStage, sceneTarget, warmth, type Mood } from '@/logic/scene-state';
import { useTheme } from '@/theme/theme-context';

import { roomPalette } from './palette';
import { Curtains, Dust, Floor, Lamp, Plant, Rays, ROOM, RoomWindow, Sill, Veil } from './room-parts';
import { RoomReadouts } from './room-readouts';

/** Share of the screen height the room may use. */
const MAX_HEIGHT_SHARE = 0.34;
/** How far (room units) the room drifts up as it leaves for a workout. */
const ROOM_LIFT = 24;
/** Milo's square stage in room units, standing on the floor in the middle of the room. */
const MILO = { size: 200, centerX: 180, groundInStage: (208 / 240) * 200 };

const NO_CAMEOS: readonly CameoKind[] = [];
const STOP_ACTIONS = [{ name: 'activate' as const, label: 'Stop Milo' }];
/** VoiceOver: what Milo does in each cameo (the room itself is one image to VoiceOver). */
const CAMEO_WORDS: Record<CameoKind, string> = {
  stretch: 'Milo stretches with you',
  walk: 'Milo walks on the spot',
  run: 'Milo does a little run',
  squat: 'Milo does a few squats',
};

/** Milo Steps, as the room needs it. Leave it out (the setting is off) and nothing about the room changes. */
export type SceneSteps = {
  /** Today's steps (the readout). */
  count: number;
  /** Your live gait: 0 still, 1 walking, 2 running. */
  gait: number;
  /** 0–100: livelier idle moves. */
  energy: number;
  /** The highest milestone reached today (the readout's badge). */
  badge: number | null;
  /** A replay waiting to play (what you did since you last looked); empty for none. It plays once
   *  Milo is free, and `onReplayed` is called as it starts (pass a new array for the next one). */
  replay: readonly ReplayPart[];
  onReplayed?: () => void;
  /** Bump when a step milestone is crossed: a short celebration. */
  milestoneCue: number;
  /** Tapping the readout (opens the steps sheet). */
  onPress?: () => void;
};

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
  /** Bump with the activities just logged: Milo acts each one out (queued, never stacked). */
  cameoCue?: number;
  cameoKinds?: readonly CameoKind[];
  /** Milo wears his towel (a workout is done today). */
  towel?: boolean;
  miloCue?: number;
  /** Settings → "Show water on Milo": today's water fills him up, with a small readout above him. */
  waterOnMilo?: boolean;
  /** Bump to ask for a glance at his bowl (Home decides: behind pace, a few times a day)... */
  glanceCue?: number;
  /** ...called when he actually takes it (he's sitting, free, and motion is on), so Home can count it. */
  onGlanced?: () => void | Promise<void>;
  /** Tapping the readout (opens the water pop-up). */
  onWaterPress?: () => void;
  /** Scene Lab: false while setting the level by hand, so a change is not played as a drink. */
  pourOnRise?: boolean;
  /** Milo Steps ("Milo moves with me"): leave out when it's off. */
  steps?: SceneSteps;
};

export const LivingScene = memo(function LivingScene({ activeMinutes, goalMinutes, waterMl, waterGoalMl, hour, maxHeight, from, miloOverride, miloCue = 0, departCue = 0, onDeparted, onAbandoned, arriveCue = 0, towel = false, cameoCue = 0, cameoKinds = NO_CAMEOS, waterOnMilo = false, glanceCue = 0, onGlanced, onWaterPress, pourOnRise = true, steps }: Props) {
  const { width, height } = useWindowDimensions();
  const { isDark } = useTheme();
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
  const day = useSharedValue(daylight(hour));
  const fade = useSharedValue(1); // Reduce Motion: the room dips to swap states unseen
  const cool = useDerivedValue(() => dimness(stage.get()));
  const warm = useDerivedValue(() => warmth(stage.get()));
  const trip = useSharedValue(0); // 0 = the room is here, 1 = it has eased up and out (off to a workout)
  useEffect(() => () => [stage, day, fade, fit, trip].forEach((v) => cancelAnimation(v)), [stage, day, fade, fit, trip]);

  // ----- leaving for a workout, and coming back -----
  type Travel = 'none' | 'departing' | 'arriving';
  const [travel, setTravel] = useState<Travel>('none');
  const [seen, setSeen] = useState({ departCue, arriveCue });
  // Cues already given when the room appeared (it was rebuilt, e.g. after a theme change) never replay.
  const [initialCues] = useState({ departCue, arriveCue });
  // ----- activity cameos: a line of them, one at a time -----
  const [queue, setQueue] = useState<CameoKind[]>([]);
  const [playing, setPlaying] = useState<CameoKind | null>(null);
  const [seenCameo, setSeenCameo] = useState(cameoCue);
  if (seenCameo !== cameoCue) {
    setSeenCameo(cameoCue);
    setQueue(enqueueCameos(queue, cameoKinds, playing));
  }
  const stopCameos = () => {
    setQueue([]);
    setPlaying(null);
  };
  // Leaving the screen (a tab, the background) or the Lab taking over Milo ends any cameos.
  if ((!onScreen || miloOverride) && (playing !== null || queue.length > 0)) stopCameos();

  if (seen.departCue !== departCue || seen.arriveCue !== arriveCue) {
    setSeen({ departCue, arriveCue });
    if (seen.departCue !== departCue && departCue) {
      setTravel('departing');
      stopCameos(); // leaving for a workout cuts any cameo short
    } else if (seen.arriveCue !== arriveCue && arriveCue) setTravel('arriving');
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
      if (Math.abs(stage.get() - target.stage) < 0.001) return;
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
      return;
    }
    if (catchUp) {
      // Coming back: a short, calm catch-up from what you last saw.
      const ease = { duration: DURATION.transition.long, easing: EASE.inOut };
      stage.set(withDelay(DURATION.micro.slow, withTiming(target.stage, ease)));
    } else {
      stage.set(withSpring(target.stage, SPRING.gentle));
    }
  }, [target.stage, reduced, onScreen, stage, fade]);

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
  // The next cameo starts after a short pause, only while the room is on screen, Milo is home and
  // nothing else (the Lab) is driving him.
  // Never while he's in the middle of waking up: the wake move plays first.
  const free = onScreen && travel === 'none' && !miloOverride && playing === null && milo !== 'waking';
  const next = queue[0];
  useEffect(() => {
    if (!free || !next) return;
    const t = setTimeout(() => {
      setPlaying(next);
      setQueue((q) => q.slice(1));
      AccessibilityInfo.announceForAccessibility(CAMEO_WORDS[next]);
    }, CAMEO.gap);
    return () => clearTimeout(t);
  }, [free, next]);

  // ----- water on Milo: held while the room is covered, like the room's own numbers -----
  // Each rise is one drink (pour, slosh, his reaction); reaching the goal adds a shimmer and his paw lift.
  const [drinks, setDrinks] = useState({ ml: waterMl, drink: 0, goal: 0 });
  if (onScreen && drinks.ml !== waterMl) {
    const rose = pourOnRise && waterMl > drinks.ml;
    // The goal moment belongs to the water on Milo: with it off, Milo does nothing new.
    const reached = waterOnMilo && rose && fillLevel(drinks.ml, waterGoalMl) < 1 && fillLevel(waterMl, waterGoalMl) >= 1;
    setDrinks({ ml: waterMl, drink: drinks.drink + (rose ? 1 : 0), goal: drinks.goal + (reached ? 1 : 0) });
  }
  const [goalPaw, setGoalPaw] = useState(false);
  const canWave = useRef(false);
  useEffect(() => {
    canWave.current = free && (milo === 'sitting' || milo === 'content');
  });
  useEffect(() => {
    if (!drinks.goal || reduced) return;
    // After the shimmer: his happy paw lift, if he's up and nothing else is going on.
    const t = setTimeout(() => {
      if (canWave.current) setGoalPaw(true);
    }, WATER.pourLand + SPRING.gentle.duration + WATER.goalPose);
    return () => clearTimeout(t);
  }, [drinks.goal, reduced]);
  // Anything else that starts (a cameo, a trip, the Lab, leaving the screen) ends it.
  if (goalPaw && (playing !== null || travel !== 'none' || miloOverride || !onScreen)) setGoalPaw(false);
  // A glance is only passed on when he can take it; otherwise the request is dropped (and not counted).
  const [glance, setGlance] = useState({ asked: glanceCue, shown: 0 });
  if (glance.asked !== glanceCue) {
    const ok = waterOnMilo && !reduced && free && !goalPaw && milo === 'sitting';
    setGlance({ asked: glanceCue, shown: glance.shown + (ok ? 1 : 0) });
  }
  const glancedRef = useRef(onGlanced);
  useEffect(() => {
    glancedRef.current = onGlanced;
  }, [onGlanced]);
  useEffect(() => {
    if (glance.shown) Promise.resolve(glancedRef.current?.()).catch(() => {});
  }, [glance.shown]);
  const fillNow = fillLevel(drinks.ml, waterGoalMl);
  // One stable object per change, so Milo's renderer only re-renders when something about the water changed.
  const water = useMemo<MiloWater | undefined>(
    () => (waterOnMilo ? { level: fillNow, from: start.water, drinkCue: drinks.drink, goalCue: drinks.goal, glanceCue: glance.shown } : undefined),
    [waterOnMilo, fillNow, start.water, drinks.drink, drinks.goal, glance.shown],
  );

  // ----- Milo Steps: replay, live gait, milestones -----
  // The replay: trot, then run, matching the day, then settle. Tap Milo to skip it.
  type Replay = { parts: readonly ReplayPart[]; at: number }; // at: the part playing (-1: waiting to start)
  const [replay, setReplay] = useState<Replay | null>(null);
  const [taken, setTaken] = useState<readonly ReplayPart[] | null>(null);
  const strideFree = free && !reduced;
  // It waits while something else has Milo (a trip back from a workout, a cameo, the Lab, waking up, the
  // screen covered); once it has started, any of those ends it.
  const replayBlocked = !onScreen || travel !== 'none' || !!miloOverride || playing !== null || reduced;
  if (steps && steps.replay.length > 0 && steps.replay !== taken && !replay && !replayBlocked) {
    setTaken(steps.replay);
    setReplay({ parts: steps.replay, at: -1 });
  }
  if (replay && replayBlocked) {
    setReplay(null);
    if (replay.at < 0) setTaken(null); // not started yet: it plays when he's free again
  }
  const replayedRef = useRef(steps?.onReplayed);
  useEffect(() => {
    replayedRef.current = steps?.onReplayed;
  });
  const replayStarted = replay !== null && replay.at === 0;
  useEffect(() => {
    if (replayStarted) replayedRef.current?.();
  }, [replayStarted]);
  useEffect(() => {
    if (!replay || !strideFree) return;
    const wait = replay.at < 0 ? STRIDE.replayAfter : replay.parts[replay.at].ms;
    const t = setTimeout(() => setReplay((r) => (r && r.at + 1 < r.parts.length ? { ...r, at: r.at + 1 } : null)), wait);
    return () => clearTimeout(t);
  }, [replay, strideFree]);
  const replayGait = replay && replay.at >= 0 ? gaitLevel(replay.parts[replay.at].gait) : 0;
  // The gait he's asked for: the replay's, or yours right now.
  const gaitAsked = !steps || !strideFree ? 0 : replay ? replayGait : steps.gait;
  // He keeps striding a beat after you stop, while the stride eases out, then goes back to what he was doing.
  const [striding, setStriding] = useState(false);
  if (gaitAsked > 0 && !striding) setStriding(true);
  useEffect(() => {
    if (!striding || gaitAsked > 0) return;
    const t = setTimeout(() => setStriding(false), STRIDE.settle);
    return () => clearTimeout(t);
  }, [striding, gaitAsked]);
  // A milestone: one short celebration jump, once he's free and not moving (it waits for the replay).
  const [milestoneSeen, setMilestoneSeen] = useState(steps?.milestoneCue ?? 0);
  const [cheerAsked, setCheerAsked] = useState(false);
  const [cheer, setCheer] = useState(false);
  if (steps && milestoneSeen !== steps.milestoneCue) {
    setMilestoneSeen(steps.milestoneCue);
    if (!reduced) setCheerAsked(true);
  }
  if (cheerAsked && strideFree && !replay && gaitAsked === 0 && !goalPaw) {
    setCheerAsked(false);
    // Straight from his stride (he's up already), or when he's sitting; never by melting up from his
    // couch (asleep, the badge on the readout is the news).
    if (striding || !lyingDown(milo)) {
      setCheer(true);
      setStriding(false);
    }
  }
  if (cheer && !strideFree) setCheer(false);
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(() => setCheer(false), STRIDE.milestone);
    return () => clearTimeout(t);
  }, [cheer]);

  const onSettled = (s: MiloState) => {
    if (s === 'waking') setMilo(moodRef.current);
    if (s === 'arriving') setTravel('none');
    if (playing && s === `cameo-${playing}`) setPlaying(null); // back to what he was doing; the next one follows
    if (goalPaw && s === 'reacting') setGoalPaw(false);
  };

  const roomStyle = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - trip.get()),
    transform: [{ translateY: -trip.get() * ROOM_LIFT * k }, { scale: fit.get() }],
  }));
  const stageW = ROOM.w * k;
  const stageStyle = { position: 'absolute' as const, left: (width - stageW) / 2, top: 0, width: stageW, height: ROOM.h * k };
  const shown: MiloState =
    miloOverride ??
    (travel !== 'none' ? travel : playing ? `cameo-${playing}` : cheer ? 'celebrating' : goalPaw ? 'reacting' : striding ? 'striding' : milo);

  return (
    <>
    <Animated.View
      // While the room is away (off to a workout) it isn't read out.
      accessible={travel !== 'departing'}
      accessibilityElementsHidden={travel === 'departing'}
      importantForAccessibility={travel === 'departing' ? 'no-hide-descendants' : 'auto'}
      accessibilityRole="image"
      accessibilityLabel={describeScene(activeMinutes, goalMinutes)}
      // VoiceOver: while a cameo plays, a double-tap on the room stops it (like tapping Milo).
      accessibilityActions={playing ? STOP_ACTIONS : undefined}
      onAccessibilityAction={playing ? stopCameos : undefined}
      accessibilityHint={playing ? 'Double-tap to stop Milo' : undefined}
      style={[{ width, height: ROOM.h * k, transformOrigin: 'bottom' }, roomStyle]}>
      <Floor k={k} palette={palette} />
      <View style={stageStyle}>
        <RoomWindow k={k} day={day} palette={palette} />
        <Curtains k={k} live={live} stage={stage} palette={palette} />
        <Sill k={k} palette={palette} />
        <Plant k={k} live={live} palette={palette} />
        <Lamp k={k} live={live} stage={stage} day={day} palette={palette} />
        <Milo
          state={shown}
          cue={miloCue}
          onSettled={onSettled}
          // Tapping Milo mid-cameo stops it (and the ones waiting), or skips the replay; he goes back to what he was doing.
          onPress={playing ? stopCameos : replay ? () => setReplay(null) : undefined}
          keepCouch
          towel={towel}
          water={water}
          gait={steps && shown === 'striding' ? gaitAsked : undefined}
          energy={steps ? steps.energy / 100 : undefined}
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
    {((water && drinks.ml > 0) || (steps && steps.count > 0)) && (
      <RoomReadouts
        water={water && drinks.ml > 0 ? { ml: drinks.ml, goal: waterGoalMl, onPress: travel === 'none' ? onWaterPress : undefined } : undefined}
        steps={steps && steps.count > 0 ? { count: steps.count, badge: steps.badge, onPress: travel === 'none' ? steps.onPress : undefined } : undefined}
        k={k}
        away={trip}
        fade={fade}
        lift={ROOM_LIFT}
      />
    )}
    </>
  );
});
