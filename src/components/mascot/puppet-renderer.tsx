/**
 * PuppetRenderer: draws Milo as separate paper-puppet layers (layers.ts +
 * placeholder-art.ts) and moves each one around its own pivot with
 * Reanimated. Follows the MiloRenderer contract in types.ts.
 *
 * Everything moves on the UI thread:
 * - Transitions (once per state change): pose blends, waking, the paw lift.
 *   One-shots report back through an animation callback, not a JS timer.
 * - Idle loops (motion/ambient.ts): breathing, tail swishes, ear flicks,
 *   blinks, floating "z"s, lapping, celebration jumps. Every cycle re-rolls
 *   its timing and size, so nothing ticks like a metronome.
 * - Follow-through: ears and tail trail the body when it moves up or down.
 * Loops stop while paused (screen hidden, app in background) and everything
 * is cancelled on unmount. With Reduce Motion on, every state is a still pose.
 */
import { memo, useEffect, useRef } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ReduceMotion,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AMBIENT, ARC, CAMEO, CELEBRATE, DURATION, EASE, LEAVE, SHAPE, SPRING, WAKE, breathe, cameoLength, floatLoop, loopWithGaps, pick } from '@/motion';

import { GROUND_Y, LAYERS, LIE_POSE, NECK, STAGE, TAIL_BASE, type LayerName } from './layers';
import { Tongue, useWaterMotion, WaterLayerArt, WaterSparkles, type WaterCtx } from './milo-water';
import { MILO_FX } from './palette';
import { PLACEHOLDER_ART } from './placeholder-art';
import type { MiloRendererProps, MiloState } from './types';

const fill: ViewStyle = { position: 'absolute', left: 0, top: 0 };
const { micro, transition } = DURATION;

/** Cameo poses: how far each part moves (paw: share of the full lift; degrees; stage units). */
const CAMEO_SHAPE = {
  preStretch: { x: 1.02, y: 0.97 }, // the dip before a stretch
  stretch: { x: 0.95, y: 1.08 }, // tall and narrow
  settle: { x: 0.99, y: 1.02 }, // just past standing, so the final spring has something to settle
  squat: { y: 0.86 }, // a deeper crouch than the jump's anticipation
  dip: 0.06, // the paw dips before reaching up
  perk: 8, // ears perk on the last squat
  tilt: 6, // head tipped back in the stretch
  sway: 3, // head sway while walking
  walkBob: 3,
  runBob: 8,
  walkPaw: 0.3,
  runPaw: 0.45,
  squatPaw: 0.25,
  earsBack: 12,
} as const;

/** Reduce Motion: states that look different swap behind a quick fade. */
const LOOK: Record<MiloState, string> = {
  sleeping: 'lie',
  stirring: 'lie',
  waking: 'sit',
  sitting: 'sit',
  content: 'content',
  reacting: 'paw',
  celebrating: 'party',
  departing: 'sit',
  arriving: 'sit',
  'cameo-stretch': 'stretch',
  'cameo-walk': 'walk',
  'cameo-run': 'run',
  'cameo-squat': 'squat',
  drinking: 'drink',
};
const NEVER = ReduceMotion.Never;

type CelebrateValues = Record<'sx' | 'sy' | 'paw' | 'eyes' | 'confetti' | 'jumpY', SharedValue<number>>;

/**
 * One celebration jump: crouch (anticipation), stretch up into the air, squash on landing, settle.
 * Plain one-shot animations started from JS; the renderer's timer starts the next one. (A jump that
 * restarted itself from its own animation callback crashed the app on iPhone.)
 */
function celebrateJump({ sx, sy, paw, eyes, confetti, jumpY }: CelebrateValues) {
  const shape = (axis: 'x' | 'y') =>
    withSequence(
      withTiming(SHAPE.crouch[axis], { duration: CELEBRATE.crouch, easing: EASE.out }),
      withTiming(SHAPE.takeoff[axis], { duration: CELEBRATE.takeoff, easing: EASE.rise }),
      withDelay(CELEBRATE.land - CELEBRATE.crouch - CELEBRATE.takeoff, withTiming(SHAPE.land[axis], { duration: micro.fast, easing: EASE.out })),
      withSpring(1, SPRING.snappy),
    );
  sx.set(shape('x'));
  sy.set(shape('y'));
  paw.set(withDelay(CELEBRATE.crouch, withSequence(withSpring(1, SPRING.snappy), withDelay(micro.base, withSpring(0, SPRING.soft)))));
  eyes.set(
    withDelay(
      CELEBRATE.crouch,
      withSequence(
        withTiming(1, { duration: micro.fast, easing: EASE.out }),
        withDelay(transition.long - micro.fast, withTiming(0, { duration: micro.fast, easing: EASE.out })),
      ),
    ),
  );
  // Each burst starts from 0; the pause between jumps is longer than a burst, so the last one has landed.
  confetti.set(0);
  confetti.set(withDelay(CELEBRATE.crouch, withTiming(1, { duration: DURATION.particle, easing: EASE.rise })));
  jumpY.set(
    withDelay(
      CELEBRATE.crouch,
      withSequence(
        NEVER,
        withTiming(-ARC.jump.height, { duration: ARC.jump.rise, easing: EASE.rise, reduceMotion: NEVER }),
        withTiming(0, { duration: ARC.jump.fall, easing: EASE.fall, reduceMotion: NEVER }),
      ),
      NEVER,
    ),
  );
}

/** How far the ears and tail trail the body (degrees per stage point of lag). */
const FOLLOW = { ear: 0.45, tail: 0.5 };

const Art = memo(function Art({ name, k }: { name: LayerName; k: number }) {
  const b = LAYERS[name];
  return <SvgXml xml={PLACEHOLDER_ART[name]} width={b.w * k} height={b.h * k} />;
});

/** One puppet piece, placed on the stage and turning around its own pivot. With `water`, its art is drawn with water inside. */
function Layer({ name, k, style, water }: { name: LayerName; k: number; style?: ViewStyle | ReturnType<typeof useAnimatedStyle>; water?: WaterCtx }) {
  const b = LAYERS[name];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: b.x * k,
          top: b.y * k,
          width: b.w * k,
          height: b.h * k,
          transformOrigin: [b.pivot.x * k, b.pivot.y * k, 0],
        },
        style,
      ]}>
      {water ? <WaterLayerArt name={name} k={k} w={water} /> : <Art name={name} k={k} />}
    </Animated.View>
  );
}

// ---------- code-drawn particles (confetti and paw sparks) ----------

type Piece = { angle: number; dist: number; spin: number; w: number; h: number; round: boolean; color: string; gravity: number };

/** Deterministic "random" so the confetti looks the same every render. */
function makePieces(count: number, opts: { minDist: number; maxDist: number; size: number; gravity: number; round?: boolean }): Piece[] {
  const colors = MILO_FX.confetti;
  return Array.from({ length: count }, (_, i) => {
    const r = (n: number) => ((Math.sin((i + 1) * 12.9898 * n) * 43758.5453) % 1 + 1) % 1;
    const angle = (-170 + (160 * (i + r(1))) / count) * (Math.PI / 180); // an upward fan
    return {
      angle,
      dist: opts.minDist + r(2) * (opts.maxDist - opts.minDist),
      spin: 180 + r(3) * 360,
      w: opts.size * (0.7 + r(4) * 0.6),
      h: opts.round ? opts.size : opts.size * (0.45 + r(5) * 0.3),
      round: opts.round ?? i % 3 === 0,
      color: colors[i % colors.length],
      gravity: opts.gravity,
    };
  });
}

const CONFETTI_ORIGIN = { x: 120, y: 120 };
const SPARK_ORIGIN = { x: 176, y: 122 };
const CONFETTI = makePieces(16, { minDist: 60, maxDist: 115, size: 9, gravity: 80 });
const SPARKS = makePieces(5, { minDist: 22, maxDist: 38, size: 6, gravity: 0, round: true });

function Particle({ piece, progress, k, origin }: { piece: Piece; progress: SharedValue<number>; k: number; origin: { x: number; y: number } }) {
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    const x = Math.cos(piece.angle) * piece.dist * t;
    const y = Math.sin(piece.angle) * piece.dist * t + piece.gravity * t * t;
    const opacity = t <= 0 || t >= 1 ? 0 : t < 0.7 ? 0.8 : (0.8 * (1 - t)) / 0.3;
    return {
      opacity,
      transform: [{ translateX: x * k }, { translateY: y * k }, { rotate: `${piece.spin * t}deg` }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (origin.x - piece.w / 2) * k,
          top: (origin.y - piece.h / 2) * k,
          width: piece.w * k,
          height: piece.h * k,
          borderRadius: piece.round ? (piece.w * k) / 2 : 2 * k,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

// ---------- floating "z" ----------

function Z({ progress, on, k, color }: { progress: SharedValue<number>; on: SharedValue<number>; k: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: Math.sin(Math.PI * t) * on.get(),
      transform: [
        { translateX: (t * 20 + Math.sin(t * Math.PI * 2) * 3) * k }, // drifts right with a slight waver
        { translateY: -t * 40 * k },
        { scale: 0.7 + t * 0.5 },
      ],
    };
  });
  return (
    <Animated.Text
      accessible={false}
      allowFontScaling={false}
      style={[
        { position: 'absolute', left: 106 * k, top: 82 * k, fontSize: Math.max(12, 22 * k), fontWeight: '700', color },
        style,
      ]}>
      z
    </Animated.Text>
  );
}

// ---------- the renderer ----------

export const PuppetRenderer = memo(function PuppetRenderer({ state, size, cue, tapSignal, paused, reducedMotion, isDark, keepCouch = false, towel = false, water, onSettled }: MiloRendererProps) {
  const k = size / STAGE;
  const lying = state === 'sleeping' || state === 'stirring' || state === 'waking';

  // Pose: 0 = lying on the couch, 1 = sitting. Waking blends between them.
  const pose = useSharedValue(lying ? 0 : 1);
  const headLift = useSharedValue(0);
  const headTurn = useSharedValue(0);
  const dip = useSharedValue(state === 'drinking' ? 1 : 0);
  const lap = useSharedValue(0);
  const breath = useSharedValue(0);
  const breathDepth = useSharedValue(1);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const jumpY = useSharedValue(0);
  const followY = useSharedValue(0); // trails jumpY, so ears and tail lag behind the body
  const tailSway = useSharedValue(0);
  const earL = useSharedValue(0);
  const earR = useSharedValue(0);
  const earTapL = useSharedValue(0); // tap twitches add on top, so they never stop the idle ear loop
  const earTapR = useSharedValue(0);
  const stageOpacity = useSharedValue(1); // Reduce Motion: dips to swap poses unseen
  const eyes = useSharedValue(state === 'sleeping' || state === 'stirring' || state === 'drinking' || state === 'content' ? 1 : 0); // 1 = closed
  const paw = useSharedValue(0);
  const bowl = useSharedValue(state === 'drinking' ? 1 : 0);
  const z1 = useSharedValue(0);
  const z2 = useSharedValue(0);
  const z3 = useSharedValue(0);
  const zzOn = useSharedValue(state === 'sleeping' ? 1 : 0);
  const confetti = useSharedValue(0);
  const sparks = useSharedValue(0);
  const near = useSharedValue(1); // scale toward the viewer while leaping off or back in
  const present = useSharedValue(1); // fades him in when he arrives from below the room
  const towelOn = useSharedValue(towel ? 1 : 0);
  // Water inside him (Home): its own values, added on top of his motion; all at rest when it's off.
  const wm = useWaterMotion(water, state, reducedMotion, { breath, breathDepth, pose, headLift, paw });
  const wet = wm.wet ? wm.ctx : undefined;

  // Cancel every animation when Milo leaves the screen for good.
  const allRef = useRef([pose, headLift, headTurn, dip, lap, breath, breathDepth, sx, sy, jumpY, followY, tailSway, earL, earR, earTapL, earTapR, stageOpacity, eyes, paw, bowl, z1, z2, z3, zzOn, confetti, sparks, near, present, towelOn]);
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    const all = allRef.current;
    return () => {
      unmounted.current = true;
      all.forEach((v) => cancelAnimation(v));
    };
  }, []);

  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);
  const stateRef = useRef<MiloState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const lookRef = useRef<string | null>(null);
  const wasReducedRef = useRef(reducedMotion);

  // ----- transitions: run once per state change (or cue) -----
  useEffect(() => {
    const R = reducedMotion;
    let reducedTimer: ReturnType<typeof setTimeout> | undefined;
    const settle = (s: MiloState) => settledRef.current(s);

    // Reduce Motion: no movement. When the look changes, Milo fades out, the
    // pose swaps while he's invisible, and he fades back in (a simple cross-fade).
    const look = LOOK[state];
    // Also when Reduce Motion has just been turned on, so a half-finished move doesn't snap.
    const swap = R && ((lookRef.current !== null && lookRef.current !== look) || !wasReducedRef.current);
    lookRef.current = look;
    wasReducedRef.current = R;
    if (swap)
      stageOpacity.set(
        withSequence(
          NEVER,
          withTiming(0, { duration: micro.fast, easing: EASE.out, reduceMotion: NEVER }),
          withTiming(1, { duration: micro.base, easing: EASE.inOut, reduceMotion: NEVER }),
        ),
      );
    const place = (v: SharedValue<number>, target: number) =>
      v.set(swap ? withDelay(micro.fast, withTiming(target, { duration: 0, reduceMotion: NEVER }), NEVER) : target);

    const to = (v: SharedValue<number>, target: number, cfg: WithSpringConfig = SPRING.soft) => (R ? place(v, target) : v.set(withSpring(target, cfg)));
    const fade = (v: SharedValue<number>, target: number, ms: number = micro.slow) =>
      R ? place(v, target) : v.set(withTiming(target, { duration: ms, easing: EASE.out }));

    fade(zzOn, state === 'sleeping' ? 1 : 0, transition.short);
    fade(bowl, state === 'drinking' ? 1 : 0);
    to(dip, state === 'drinking' ? 1 : 0);
    // Leaving a celebration: let confetti already in the air finish falling (it fades out at 1).
    const c = confetti.get();
    if (state !== 'celebrating' && c > 0 && c < 1) {
      if (R) place(confetti, 1);
      else confetti.set(withTiming(1, { duration: DURATION.particle * (1 - c), easing: EASE.rise }));
    }
    if (state !== 'reacting' && state !== 'celebrating') to(paw, 0);
    const travelling = state === 'waking' || state === 'departing' || state === 'arriving';
    if (!travelling) {
      to(jumpY, 0);
      to(sx, 1);
      to(sy, 1);
      to(near, 1);
      to(present, 1);
    }
    // Cameo leftovers (a head tilt, ears) ease home when anything else starts, e.g. a cameo cut short.
    if (!state.startsWith('cameo-')) {
      to(headTurn, 0);
      if (state !== 'departing') {
        to(earTapL, 0);
        to(earTapR, 0);
      }
    }

    switch (state) {
      case 'sleeping':
      case 'stirring':
        to(pose, 0, SPRING.gentle);
        to(headLift, 0, SPRING.gentle);
        // Eyelids close slowly, like dozing off.
        if (R) place(eyes, 1);
        else eyes.set(withTiming(1, { duration: transition.short, easing: EASE.inOut }));
        break;

      case 'sitting':
        to(pose, 1, SPRING.gentle);
        to(headLift, 0);
        fade(eyes, 0, micro.base);
        break;

      case 'content':
        to(pose, 1, SPRING.gentle);
        to(headLift, 0);
        // Eyes settle closed, happily.
        if (R) place(eyes, 1);
        else eyes.set(withTiming(1, { duration: transition.short, easing: EASE.inOut }));
        break;

      case 'drinking':
        to(pose, 1, SPRING.gentle);
        fade(eyes, 1);
        break;

      case 'waking': {
        if (R || pose.get() > 0.99) {
          to(jumpY, 0);
          to(sx, 1);
          to(sy, 1);
          place(pose, 1);
          place(headLift, 0);
          place(eyes, 0);
          // Report back once any fade has finished, so "sitting" doesn't cut into it.
          reducedTimer = setTimeout(() => settle('waking'), micro.fast + micro.base);
          break;
        }
        // 1. The head lifts and the eyes open; it lowers again as he lands (springs settle in about 1.5x their duration).
        headLift.set(withSequence(withSpring(1, SPRING.gentle), withDelay(WAKE.land - SPRING.gentle.duration * 1.5, withSpring(0, SPRING.soft))));
        eyes.set(withDelay(WAKE.eyesOpen, withTiming(0, { duration: micro.base, easing: EASE.out })));
        // 2. A long, low stretch, a crouch (anticipation), up into the hop, down, a squash on landing, settle.
        const body = (axis: 'x' | 'y') =>
          withDelay(
            WAKE.stretch,
            withSequence(
              withTiming(SHAPE.stretchLong[axis], { duration: transition.short, easing: EASE.out }),
              withTiming(SHAPE.crouch[axis], { duration: micro.base, easing: EASE.inOut }),
              withTiming(SHAPE.takeoff[axis], { duration: ARC.hop.rise, easing: EASE.rise }),
              withTiming(1, { duration: ARC.hop.fall, easing: EASE.fall }),
              withTiming(SHAPE.land[axis], { duration: micro.fast, easing: EASE.out }),
              withSpring(1, SPRING.snappy, (finished) => {
                if (finished && axis === 'y') scheduleOnRN(settle, 'waking');
              }),
            ),
          );
        sx.set(body('x'));
        sy.set(body('y'));
        // 3. One hop arc while the lying pose blends into sitting.
        jumpY.set(
          withDelay(
            WAKE.hop,
            withSequence(
              withTiming(-ARC.hop.height, { duration: ARC.hop.rise, easing: EASE.rise }),
              withTiming(0, { duration: ARC.hop.fall, easing: EASE.fall }),
            ),
          ),
        );
        pose.set(withDelay(WAKE.hop, withTiming(1, { duration: ARC.hop.rise + ARC.hop.fall, easing: EASE.inOut })));
        break;
      }

      case 'reacting':
        to(pose, 1);
        fade(eyes, 0, micro.base);
        if (R) {
          place(paw, 1);
          reducedTimer = setTimeout(() => settle('reacting'), transition.long * 2);
          break;
        }
        paw.set(
          withSequence(
            withTiming(-0.06, { duration: micro.fast, easing: EASE.inOut }), // a small dip before lifting (anticipation)
            withSpring(1, SPRING.snappy),
            withDelay(
              transition.base,
              withSpring(0, SPRING.soft, (finished) => {
                if (finished) scheduleOnRN(settle, 'reacting');
              }),
            ),
          ),
        );
        sparks.set(0);
        sparks.set(withDelay(micro.fast, withTiming(1, { duration: transition.long, easing: EASE.out })));
        break;

      case 'departing': {
        // Ears perk, a crouch (anticipation), one arc off the couch toward you, and a soft landing
        // on the floor in front (squash, then a small settle). He ends up a little bigger: closer.
        if (R) {
          // Still pose; the room's own fade carries the change.
          place(pose, 1);
          place(eyes, 0);
          break;
        }
        pose.set(withTiming(1, { duration: LEAVE.takeoff, easing: EASE.inOut })); // off the couch if he was lying on it
        to(headLift, 0);
        eyes.set(withTiming(0, { duration: micro.fast, easing: EASE.out }));
        const perk = (deg: number) =>
          withDelay(LEAVE.perk, withSequence(withTiming(deg, { duration: micro.fast, easing: EASE.out }), withDelay(transition.short, withSpring(0, SPRING.soft))));
        earTapL.set(perk(8));
        earTapR.set(perk(-8));
        const leap = (axis: 'x' | 'y') =>
          withDelay(
            LEAVE.crouch,
            withSequence(
              withTiming(SHAPE.crouch[axis], { duration: LEAVE.takeoff - LEAVE.crouch, easing: EASE.out }),
              withTiming(SHAPE.takeoff[axis], { duration: ARC.leap.rise, easing: EASE.rise }),
              withTiming(1, { duration: ARC.leap.fall, easing: EASE.fall }),
              withTiming(SHAPE.land[axis], { duration: micro.fast, easing: EASE.out }),
              withSpring(1, SPRING.snappy),
            ),
          );
        sx.set(leap('x'));
        sy.set(leap('y'));
        jumpY.set(
          withDelay(
            LEAVE.takeoff,
            withSequence(
              withTiming(-ARC.leap.height, { duration: ARC.leap.rise, easing: EASE.rise }),
              withTiming(0, { duration: ARC.leap.fall, easing: EASE.fall }),
            ),
          ),
        );
        near.set(withDelay(LEAVE.takeoff, withTiming(ARC.leap.near, { duration: ARC.leap.rise + ARC.leap.fall, easing: EASE.inOut })));
        break;
      }

      case 'arriving': {
        // The way back: he starts close to you (bigger, faded out), crouches, hops back to his spot and lands softly.
        if (R) {
          place(pose, 1);
          place(jumpY, 0);
          place(near, 1);
          place(present, 1);
          place(eyes, 0);
          // Report back once the fade has finished, so the next mood doesn't cut into it.
          reducedTimer = setTimeout(() => settle('arriving'), micro.fast + micro.base);
          break;
        }
        pose.set(1);
        headLift.set(0);
        eyes.set(0);
        near.set(ARC.leap.near);
        present.set(0);
        present.set(withTiming(1, { duration: micro.base, easing: EASE.out }));
        const crouch = LEAVE.takeoff - LEAVE.crouch; // the same anticipation as leaving
        jumpY.set(
          withDelay(
            crouch,
            withSequence(
              withTiming(-ARC.leap.height, { duration: ARC.leap.rise, easing: EASE.rise }),
              withTiming(0, { duration: ARC.leap.fall, easing: EASE.fall }),
            ),
          ),
        );
        near.set(withDelay(crouch, withTiming(1, { duration: ARC.leap.rise + ARC.leap.fall, easing: EASE.inOut })));
        const land = (axis: 'x' | 'y') =>
          withSequence(
            withTiming(SHAPE.crouch[axis], { duration: crouch, easing: EASE.out }),
            withTiming(SHAPE.takeoff[axis], { duration: ARC.leap.rise, easing: EASE.rise }),
            withTiming(1, { duration: ARC.leap.fall, easing: EASE.fall }),
            withTiming(SHAPE.land[axis], { duration: micro.fast, easing: EASE.out }),
            withSpring(1, SPRING.snappy, (finished) => {
              if (finished && axis === 'y') scheduleOnRN(settle, 'arriving');
            }),
          );
        sx.set(land('x'));
        sy.set(land('y'));
        break;
      }

      case 'cameo-stretch':
      case 'cameo-walk':
      case 'cameo-run':
      case 'cameo-squat': {
        to(headLift, 0);
        if (R) {
          // A still pose for the activity, then back.
          to(pose, 1);
          if (state === 'cameo-stretch') {
            place(paw, 1);
            place(eyes, 1);
          } else if (state === 'cameo-squat') {
            place(sx, SHAPE.crouch.x);
            place(sy, CAMEO_SHAPE.squat.y);
          } else if (state === 'cameo-run') {
            place(paw, CAMEO_SHAPE.runPaw);
            place(earTapL, -CAMEO_SHAPE.earsBack);
            place(earTapR, CAMEO_SHAPE.earsBack);
          } else place(paw, CAMEO_SHAPE.walkPaw);
          if (state !== 'cameo-stretch') place(eyes, 0); // eyes open for the active ones
          reducedTimer = setTimeout(() => settle(state), CAMEO.still);
          break;
        }
        // Lying down? First a little hop up to sitting (pose blend, squash on landing), then the cameo.
        const up = pose.get() < 0.99 ? ARC.hop.rise + ARC.hop.fall : 0;
        if (up) {
          pose.set(withTiming(1, { duration: up, easing: EASE.inOut }));
          eyes.set(withTiming(0, { duration: micro.base, easing: EASE.out }));
        }
        const hop = up
          ? [withTiming(-ARC.hop.height, { duration: ARC.hop.rise, easing: EASE.rise }), withTiming(0, { duration: ARC.hop.fall, easing: EASE.fall })]
          : [];
        // The body stretches up for the hop and squashes as it lands, then goes straight into the wind-up.
        const hopShape = (axis: 'x' | 'y') =>
          up
            ? [
                withTiming(SHAPE.takeoff[axis], { duration: ARC.hop.rise, easing: EASE.rise }),
                withTiming(SHAPE.land[axis], { duration: ARC.hop.fall, easing: EASE.fall }),
              ]
            : [];
        const later = (anim: number) => (up ? withDelay(up, anim) : anim);
        const t = (v: number, ms: number) => withTiming(v, { duration: ms, easing: EASE.inOut });
        // Reports back on the last move, not after the final settle, so each cameo stays within ~2.5 s.
        const done = (finished?: boolean) => {
          'worklet';
          if (finished) scheduleOnRN(settle, state);
        };
        const w = CAMEO.windUp;
        if (state !== 'cameo-stretch' && !up) eyes.set(withTiming(0, { duration: micro.base, easing: EASE.out }));

        if (state === 'cameo-stretch') {
          // A small dip (anticipation), reach up tall with eyes closed and the head tipped back, hold,
          // let go just past rest, and settle.
          const { reach, hold, release } = CAMEO.stretch;
          paw.set(later(withSequence(t(-CAMEO_SHAPE.dip, w), t(1, reach), withDelay(hold, t(0, release)))));
          sx.set(withSequence(...hopShape('x'), t(CAMEO_SHAPE.preStretch.x, w), t(CAMEO_SHAPE.stretch.x, reach), withDelay(hold, t(CAMEO_SHAPE.settle.x, release)), withSpring(1, SPRING.snappy)));
          sy.set(withSequence(...hopShape('y'), t(CAMEO_SHAPE.preStretch.y, w), t(CAMEO_SHAPE.stretch.y, reach), withDelay(hold, withTiming(CAMEO_SHAPE.settle.y, { duration: release, easing: EASE.inOut }, done)), withSpring(1, SPRING.snappy)));
          eyes.set(later(withSequence(withDelay(w, t(1, reach)), withDelay(hold, t(0, release)))));
          headTurn.set(later(withSequence(withDelay(w, t(-CAMEO_SHAPE.tilt, reach)), withDelay(hold, t(0, release)))));
          if (up) jumpY.set(withSequence(...hop));
        } else if (state === 'cameo-walk') {
          // Weight shifts side to side with every step (head sway); the paw steps on every other one,
          // a soft bob throughout, and the secondary motion trails the bob a touch.
          const { step, steps } = CAMEO.walk;
          const half = step / 2;
          const bob: number[] = [];
          const sway: number[] = [t(-CAMEO_SHAPE.sway, w)];
          const pawSteps: number[] = [withTiming(0, { duration: w })];
          for (let i = 0; i < steps; i++) {
            bob.push(withTiming(-CAMEO_SHAPE.walkBob, { duration: half, easing: EASE.breathe }), withTiming(0, { duration: half, easing: EASE.breathe }));
            sway.push(t(i % 2 === 0 ? CAMEO_SHAPE.sway : -CAMEO_SHAPE.sway, step));
            pawSteps.push(i % 2 === 0 ? withSequence(t(CAMEO_SHAPE.walkPaw, half), t(0, half)) : withTiming(0, { duration: step }));
          }
          jumpY.set(withSequence(...hop, withTiming(0, { duration: w }), ...bob.slice(0, -1), withTiming(0, { duration: half, easing: EASE.breathe }, done)));
          if (up) {
            sx.set(withSequence(...hopShape('x'), withSpring(1, SPRING.snappy)));
            sy.set(withSequence(...hopShape('y'), withSpring(1, SPRING.snappy)));
          }
          headTurn.set(later(withSequence(...sway, withSpring(0, SPRING.soft))));
          paw.set(later(withDelay(micro.fast / 3, withSequence(...pawSteps))));
        } else if (state === 'cameo-run') {
          // A crouch (anticipation), then strides: stretched as he leaves the ground, squashed as he lands,
          // ears swept back, the paw pumping a beat behind; a squash-and-settle at the end.
          const { stride, strides } = CAMEO.run;
          const half = stride / 2;
          const air: number[] = [];
          const bodyY: number[] = [t(SHAPE.crouch.y, w)];
          const bodyX: number[] = [t(SHAPE.crouch.x, w)];
          const pump: number[] = [withTiming(0, { duration: w })];
          for (let i = 0; i < strides; i++) {
            air.push(withTiming(-CAMEO_SHAPE.runBob, { duration: half, easing: EASE.rise }), withTiming(0, { duration: half, easing: EASE.fall }));
            bodyY.push(withTiming(SHAPE.takeoff.y, { duration: half, easing: EASE.out }), withTiming(SHAPE.land.y, { duration: half, easing: EASE.fall }));
            bodyX.push(withTiming(SHAPE.takeoff.x, { duration: half, easing: EASE.out }), withTiming(SHAPE.land.x, { duration: half, easing: EASE.fall }));
            pump.push(t(CAMEO_SHAPE.runPaw, half), t(0, half));
          }
          jumpY.set(withSequence(...hop, withTiming(0, { duration: w }), ...air));
          // The last landing reports back; the spring after it settles while he returns to what he was doing.
          bodyY[bodyY.length - 1] = withTiming(SHAPE.land.y, { duration: half, easing: EASE.fall }, done);
          sy.set(withSequence(...hopShape('y'), ...bodyY, withSpring(1, SPRING.snappy)));
          sx.set(withSequence(...hopShape('x'), ...bodyX, withSpring(1, SPRING.snappy)));
          paw.set(later(withDelay(micro.fast / 3, withSequence(...pump, withSpring(0, SPRING.soft)))));
          const back = (deg: number) =>
            later(withSequence(withTiming(deg, { duration: w, easing: EASE.out }), withDelay(cameoLength('run') - 2 * w, withSpring(0, SPRING.soft))));
          earTapL.set(back(-CAMEO_SHAPE.earsBack));
          earTapR.set(back(CAMEO_SHAPE.earsBack));
        } else {
          // A small rise (anticipation), then slow squats: down with the paw reaching forward for balance,
          // up just past standing; the ears perk on the last one, then a settle.
          const { down, up: rise, reps } = CAMEO.squat;
          const bodyY: number[] = [t(CAMEO_SHAPE.settle.y, w)];
          const bodyX: number[] = [t(CAMEO_SHAPE.settle.x, w)];
          const reach: number[] = [withTiming(0, { duration: w })];
          for (let i = 0; i < reps; i++) {
            bodyY.push(t(CAMEO_SHAPE.squat.y, down), t(CAMEO_SHAPE.settle.y, rise));
            bodyX.push(t(SHAPE.crouch.x, down), t(CAMEO_SHAPE.settle.x, rise));
            reach.push(t(CAMEO_SHAPE.squatPaw, down), t(0, rise));
          }
          bodyY[bodyY.length - 1] = withTiming(CAMEO_SHAPE.settle.y, { duration: rise, easing: EASE.inOut }, done);
          sy.set(withSequence(...hopShape('y'), ...bodyY, withSpring(1, SPRING.snappy)));
          sx.set(withSequence(...hopShape('x'), ...bodyX, withSpring(1, SPRING.snappy)));
          paw.set(later(withSequence(...reach)));
          const perk = (deg: number) => later(withDelay(cameoLength('squat') - rise, withSequence(withTiming(deg, { duration: micro.fast, easing: EASE.out }), withSpring(0, SPRING.soft))));
          earTapL.set(perk(CAMEO_SHAPE.perk));
          earTapR.set(perk(-CAMEO_SHAPE.perk));
          if (up) jumpY.set(withSequence(...hop));
        }
        break;
      }

      case 'celebrating':
        to(pose, 1);
        if (R) {
          // still pose: paw up, happy eyes, confetti frozen mid-air
          place(paw, 1);
          place(eyes, 1);
          place(confetti, 0.45);
        }
        break;
    }
    return () => clearTimeout(reducedTimer);
    // Shared values are stable; only state, cue and Reduce Motion restart a transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, cue, reducedMotion]);

  // ----- idle loops: stopped while paused or with Reduce Motion -----
  const celebrateCue = state === 'celebrating' ? cue : 0;
  useEffect(() => {
    const loops = [breath, z1, z2, z3, tailSway, earL, earR, lap];
    if (state === 'sitting' || state === 'reacting' || state === 'content') loops.push(eyes);
    if (state === 'celebrating') loops.push(sx, sy, paw, eyes, confetti, jumpY);
    const stopAll = () => {
      loops.forEach((v) => cancelAnimation(v));
      if (state === 'celebrating' && !unmounted.current) {
        // Don't leave Milo frozen mid-air: land softly (state changes override this with their own pose).
        [sx, sy].forEach((v) => v.set(withSpring(1, SPRING.soft)));
        [jumpY, paw].forEach((v) => v.set(withSpring(0, SPRING.soft)));
        eyes.set(withTiming(0, { duration: micro.base, easing: EASE.out }));
      }
    };

    // Nothing runs here while paused or with Reduce Motion; the previous run's
    // cleanup already stopped its loops. Reduce Motion also clears idle offsets
    // (but leaves paw, eyes and confetti to the still pose the transition set).
    if (reducedMotion) {
      // Zeroed behind the Reduce Motion fade, like the pose swap.
      [breath, tailSway, earL, earR, lap, z1, z2, z3].forEach((v) =>
        v.set(withDelay(micro.fast, withTiming(0, { duration: 0, reduceMotion: NEVER }), NEVER)),
      );
      return;
    }
    if (paused) return;
    const sleeping = state === 'sleeping';
    const lyingDown = sleeping || state === 'stirring';
    const content = state === 'content';

    const breathRange =
      state === 'sleeping' ? AMBIENT.breathSleeping : state === 'stirring' ? AMBIENT.breathStirring : content ? AMBIENT.breathContent : AMBIENT.breathAwake;
    breathe(breath, breathDepth, breathRange, AMBIENT.breathDepth);

    if (sleeping) {
      // Three "z"s, each on its own randomised clock, started a beat apart.
      floatLoop(z1, 0, AMBIENT.zGap, AMBIENT.zRise);
      floatLoop(z2, AMBIENT.zGap.max, AMBIENT.zGap, AMBIENT.zRise);
      floatLoop(z3, AMBIENT.zGap.max * 2, AMBIENT.zGap, AMBIENT.zRise);
    }

    const sway = lyingDown ? 5 : content ? 6 : 10;
    const tailGap = lyingDown ? AMBIENT.tailGapSleeping : content ? AMBIENT.tailGapContent : AMBIENT.tailGapAwake;
    loopWithGaps(tailSway, 0, tailGap, () => {
      'worklet';
      const a = sway * pick(AMBIENT.tailSize, Math.random());
      return withSequence(
        withTiming(a, { duration: transition.base, easing: EASE.inOut }),
        withTiming(-a * 0.6, { duration: transition.base + micro.fast, easing: EASE.inOut }),
        withSpring(0, SPRING.soft),
      );
    });

    const flick = (dir: number) => () => {
      'worklet';
      return withSequence(withTiming(dir * (10 + Math.random() * 5), { duration: micro.fast, easing: EASE.out }), withSpring(0, SPRING.snappy));
    };
    const earGap = state === 'stirring' ? AMBIENT.earGapStirring : AMBIENT.earGap;
    loopWithGaps(earL, 0, earGap, flick(-1));
    loopWithGaps(earR, 0, earGap, flick(1));

    if (content) {
      // A slow "cat blink": the eyes open a little, linger, and close again.
      loopWithGaps(eyes, 1, AMBIENT.contentBlinkGap, () => {
        'worklet';
        return withSequence(
          withTiming(0.35, { duration: transition.short, easing: EASE.inOut }),
          withDelay(transition.base, withTiming(1, { duration: transition.base, easing: EASE.inOut })),
        );
      });
    }

    if (state === 'sitting' || state === 'reacting') {
      loopWithGaps(eyes, 0, AMBIENT.blinkGap, () => {
        'worklet';
        const blink = () => withSequence(withTiming(1, { duration: micro.fast, easing: EASE.out }), withTiming(0, { duration: micro.fast, easing: EASE.out }));
        return Math.random() < 0.2 ? withSequence(blink(), blink()) : blink(); // now and then, a double blink
      });
    }

    if (state === 'drinking') {
      loopWithGaps(lap, 0, AMBIENT.lapGap, () => {
        'worklet';
        const lick = () => withSequence(withTiming(1, { duration: micro.base, easing: EASE.out }), withTiming(0, { duration: micro.base, easing: EASE.inOut }));
        return withSequence(lick(), lick(), lick());
      });
    } else {
      lap.set(withTiming(0, { duration: micro.fast, easing: EASE.out }));
    }

    let jumpTimer: ReturnType<typeof setTimeout> | undefined;
    if (state === 'celebrating') {
      // Jump, then again after a varied pause, until the state changes.
      const values = { sx, sy, paw, eyes, confetti, jumpY };
      const next = () => {
        celebrateJump(values);
        jumpTimer = setTimeout(next, CELEBRATE.land + transition.long + pick(AMBIENT.celebrateGap, Math.random()));
      };
      next();
    }

    return () => {
      clearTimeout(jumpTimer);
      stopAll();
    };
    // A cue replays one-shots; only the celebration loop needs restarting for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, paused, reducedMotion, celebrateCue]);

  // ----- the towel (after a workout today) fades on or off -----
  useEffect(() => {
    const target = towel ? 1 : 0;
    towelOn.set(reducedMotion ? target : withTiming(target, { duration: transition.short, easing: EASE.inOut }));
  }, [towel, reducedMotion, towelOn]);

  // ----- follow-through: ears and tail trail vertical body motion -----
  useAnimatedReaction(
    () => jumpY.get(),
    (y) => followY.set(withSpring(y, SPRING.snappy)),
  );

  // ----- tap: turn the head, or twitch the ears -----
  useEffect(() => {
    if (tapSignal === 0 || reducedMotion) return;
    const flick = (deg: number) => withSequence(withTiming(deg, { duration: micro.fast, easing: EASE.out }), withSpring(0, SPRING.snappy));
    if (stateRef.current === 'sleeping' || stateRef.current === 'stirring' || tapSignal % 2 === 0) {
      earTapL.set(flick(-14));
      earTapR.set(withDelay(micro.fast / 2, flick(14))); // the second ear a beat later
    } else {
      headTurn.set(withSequence(withTiming(9, { duration: micro.slow, easing: EASE.out }), withDelay(micro.slow, withSpring(0, SPRING.snappy))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapSignal]);

  // ----- styles -----
  const H = LIE_POSE.head;
  const T = LIE_POSE.tail;
  const amp = (q: number) => {
    'worklet';
    return (0.03 - 0.012 * q) * breathDepth.get();
  };
  const lag = () => {
    'worklet';
    return jumpY.get() - followY.get(); // negative while rising, positive while falling
  };

  const stageStyle = useAnimatedStyle(() => ({ opacity: stageOpacity.get() }));
  const rigStyle = useAnimatedStyle(() => ({
    opacity: present.get(),
    transform: [{ translateY: jumpY.get() * k }, { scale: near.get() }],
  }));
  // The towel sits on his shoulders, so it squashes, stretches and breathes with the body.
  const towelStyle = useAnimatedStyle(() => ({
    opacity: towelOn.get() * pose.get(),
    transform: [{ scaleX: sx.get() }, { scaleY: sy.get() * (1 + breath.get() * amp(1)) * (1 - dip.get() * 0.08) }],
  }));
  const couchStyle = useAnimatedStyle(() => ({ opacity: keepCouch ? 1 : 1 - pose.get() }));
  const bowlStyle = useAnimatedStyle(() => ({ opacity: Math.max(bowl.get(), wm.bowl.get()) }));

  const shadowStyle = useAnimatedStyle(() => {
    const q = pose.get();
    const air = Math.min(1, Math.max(0, -jumpY.get() / 70)); // only while he's above the floor
    return {
      opacity: (1 - air * 0.5) * present.get(),
      transform: [{ translateY: (1 - q) * 7 * k }, { scaleX: (1 - q * (100 / 220)) * (1 - air * 0.35) }],
    };
  });

  const tailStyle = useAnimatedStyle(() => {
    const q = pose.get();
    return {
      transform: [
        { translateX: T.dx * (1 - q) * k },
        { translateY: T.dy * (1 - q) * k },
        { rotate: `${T.rotate * (1 - q) + tailSway.get() - lag() * FOLLOW.tail + wm.tailFlick.get()}deg` },
      ],
    };
  });

  const bodyLieStyle = useAnimatedStyle(() => ({
    opacity: 1 - pose.get(),
    transform: [{ scaleX: sx.get() }, { scaleY: sy.get() * (1 + breath.get() * amp(0)) }],
  }));

  const bodySitStyle = useAnimatedStyle(() => ({
    opacity: pose.get(),
    transform: [{ scaleX: sx.get() }, { scaleY: sy.get() * (1 + breath.get() * amp(1)) * (1 - dip.get() * 0.08) }],
  }));

  const pawStyle = useAnimatedStyle(() => ({
    opacity: pose.get(),
    transform: [{ rotate: `${-130 * paw.get()}deg` }],
  }));

  const headStyle = useAnimatedStyle(() => {
    const q = pose.get();
    const lift = headLift.get();
    const dx = H.dx * (1 - q) + headTurn.get() * 0.4;
    const dy =
      (H.dy - lift * 12) * (1 - q) + // lying, or lifting the head while waking
      dip.get() * 44 + lap.get() * 5 + // drinking
      (1 - sy.get()) * 100 * q - // ride the body's squash and stretch
      breath.get() * 2.5 * breathDepth.get() * q +
      wm.lick.get() * 4 + wm.glance.get() * 7; // water: the lap, and a glance down at the bowl
    const rot = H.rotate * (1 - lift) * (1 - q) + headTurn.get() + wm.glance.get() * 5;
    const scale = H.scale + (1 - H.scale) * q;
    return { transform: [{ translateX: dx * k }, { translateY: dy * k }, { rotate: `${rot}deg` }, { scale }] };
  });

  // Ears fold outward while the body rises and swing back as it lands.
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.get() + earTapL.get() + lag() * FOLLOW.ear + wm.earL.get()}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.get() + earTapR.get() - lag() * FOLLOW.ear + wm.earR.get()}deg` }] }));
  // A happy blink after a drink closes the eyes on top of whatever they are doing.
  const eyesOpenStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.max(eyes.get(), wm.happy.get()) }));
  const eyesClosedStyle = useAnimatedStyle(() => ({ opacity: Math.max(eyes.get(), wm.happy.get()) }));

  const stage: ViewStyle = { ...fill, width: size, height: size };
  const fx = isDark ? MILO_FX.dark : MILO_FX.light;

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, stageStyle]}>
      {/* code-drawn contact shadow */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 10 * k,
            top: (GROUND_Y - 6) * k,
            width: 220 * k,
            height: 12 * k,
            borderRadius: 6 * k,
            backgroundColor: fx.shadow,
          },
          shadowStyle,
        ]}
      />
      <Layer name="couch" k={k} style={couchStyle} />

      <Animated.View style={[stage, { transformOrigin: [size / 2, GROUND_Y * k, 0] }, rigStyle]}>
        <Animated.View style={[stage, { transformOrigin: [TAIL_BASE.x * k, TAIL_BASE.y * k, 0] }, tailStyle]}>
          <Layer name="tail" k={k} />
        </Animated.View>
        <Layer name="body-lie" k={k} style={bodyLieStyle} water={wet} />
        <Layer name="body-sit" k={k} style={bodySitStyle} water={wet} />
        <Layer name="front-paw" k={k} style={pawStyle} water={wet} />
        <Layer name="towel" k={k} style={towelStyle} />
        <Animated.View style={[stage, { transformOrigin: [NECK.x * k, NECK.y * k, 0] }, headStyle]}>
          <Layer name="ear-left" k={k} style={earLStyle} water={wet} />
          <Layer name="ear-right" k={k} style={earRStyle} water={wet} />
          <Layer name="collar" k={k} />
          <Layer name="head" k={k} water={wet} />
          {water && <Tongue lick={wm.lick} k={k} />}
          <Layer name="eyes-open" k={k} style={eyesOpenStyle} />
          <Layer name="eyes-closed" k={k} style={eyesClosedStyle} />
        </Animated.View>
        {water && <WaterSparkles t={wm.sparkle} k={k} />}
      </Animated.View>

      <Layer name="bowl" k={k} style={bowlStyle} />

      {[z1, z2, z3].map((z, i) => (
        <Z key={i} progress={z} on={zzOn} k={k} color={fx.z} />
      ))}
      {CONFETTI.map((p, i) => (
        <Particle key={`c${i}`} piece={p} progress={confetti} k={k} origin={CONFETTI_ORIGIN} />
      ))}
      {SPARKS.map((p, i) => (
        <Particle key={`s${i}`} piece={p} progress={sparks} k={k} origin={SPARK_ORIGIN} />
      ))}
    </Animated.View>
  );
});
