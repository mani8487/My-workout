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
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AMBIENT, ARC, DURATION, EASE, SPRING, breathe, floatLoop, loopWithGaps, pick } from '@/motion';

import { GROUND_Y, LAYERS, LIE_POSE, NECK, STAGE, TAIL_BASE, type LayerName } from './layers';
import { MILO_FX } from './palette';
import { PLACEHOLDER_ART } from './placeholder-art';
import type { MiloRendererProps, MiloState } from './types';

const fill: ViewStyle = { position: 'absolute', left: 0, top: 0 };
const { micro, transition } = DURATION;

/** Squash and stretch shapes (scaleX, scaleY), volume roughly kept. */
const SHAPE = {
  stretchLong: { x: 1.1, y: 0.92 }, // waking stretch, long and low
  crouch: { x: 1.06, y: 0.9 }, // anticipation before leaving the ground
  takeoff: { x: 0.96, y: 1.06 }, // stretched upward in the air
  land: { x: 1.08, y: 0.9 }, // squash on landing
} as const;

/** Waking choreography, in ms from the start, built from the motion tokens. */
const WAKE = (() => {
  const eyesOpen = micro.slow;
  const stretch = micro.slow + micro.base;
  const hop = stretch + transition.short + micro.base; // after the stretch and a crouch
  const land = hop + ARC.hop.rise + ARC.hop.fall;
  return { eyesOpen, stretch, hop, land };
})();

/** Celebration jump, in ms from the start of each jump. */
const CELEBRATE = { crouch: micro.fast, takeoff: micro.base, land: micro.fast + ARC.jump.rise + ARC.jump.fall };

/** How far the ears and tail trail the body (degrees per stage point of lag). */
const FOLLOW = { ear: 0.45, tail: 0.5 };

const Art = memo(function Art({ name, k }: { name: LayerName; k: number }) {
  const b = LAYERS[name];
  return <SvgXml xml={PLACEHOLDER_ART[name]} width={b.w * k} height={b.h * k} />;
});

/** One puppet piece, placed on the stage and turning around its own pivot. */
function Layer({ name, k, style }: { name: LayerName; k: number; style?: ViewStyle | ReturnType<typeof useAnimatedStyle> }) {
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
      <Art name={name} k={k} />
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

export function PuppetRenderer({ state, size, cue, tapSignal, paused, reducedMotion, isDark, onSettled }: MiloRendererProps) {
  const k = size / STAGE;
  const lying = state === 'sleeping' || state === 'waking';

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
  const eyes = useSharedValue(state === 'sleeping' || state === 'drinking' ? 1 : 0); // 1 = closed
  const paw = useSharedValue(0);
  const bowl = useSharedValue(state === 'drinking' ? 1 : 0);
  const z1 = useSharedValue(0);
  const z2 = useSharedValue(0);
  const z3 = useSharedValue(0);
  const zzOn = useSharedValue(state === 'sleeping' ? 1 : 0);
  const confetti = useSharedValue(0);
  const sparks = useSharedValue(0);

  // Cancel every animation when Milo leaves the screen for good.
  const allRef = useRef([pose, headLift, headTurn, dip, lap, breath, breathDepth, sx, sy, jumpY, followY, tailSway, earL, earR, eyes, paw, bowl, z1, z2, z3, zzOn, confetti, sparks]);
  useEffect(() => {
    const all = allRef.current;
    return () => all.forEach((v) => cancelAnimation(v));
  }, []);

  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);
  const stateRef = useRef<MiloState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ----- transitions: run once per state change (or cue) -----
  useEffect(() => {
    const R = reducedMotion;
    let reducedTimer: ReturnType<typeof setTimeout> | undefined;
    const settle = (s: MiloState) => settledRef.current(s);
    const to = (v: SharedValue<number>, target: number, cfg: WithSpringConfig = SPRING.soft) => v.set(R ? target : withSpring(target, cfg));
    const fade = (v: SharedValue<number>, target: number, ms: number = micro.slow) =>
      v.set(R ? target : withTiming(target, { duration: ms, easing: EASE.out }));

    fade(zzOn, state === 'sleeping' ? 1 : 0, transition.short);
    fade(bowl, state === 'drinking' ? 1 : 0);
    to(dip, state === 'drinking' ? 1 : 0);
    // Leaving a celebration: let confetti already in the air finish falling (it fades out at 1).
    const c = confetti.get();
    if (state !== 'celebrating' && c > 0 && c < 1)
      confetti.set(R ? 1 : withTiming(1, { duration: DURATION.particle * (1 - c), easing: EASE.out }));
    if (state !== 'reacting' && state !== 'celebrating') to(paw, 0);
    if (state !== 'waking') {
      to(jumpY, 0);
      to(sx, 1);
      to(sy, 1);
    }

    switch (state) {
      case 'sleeping':
        to(pose, 0, SPRING.gentle);
        to(headLift, 0, SPRING.gentle);
        // Eyelids close slowly, like dozing off.
        eyes.set(R ? 1 : withTiming(1, { duration: transition.short, easing: EASE.inOut }));
        break;

      case 'sitting':
        to(pose, 1, SPRING.gentle);
        to(headLift, 0);
        fade(eyes, 0, micro.base);
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
          pose.set(1);
          headLift.set(0);
          eyes.set(0);
          settle('waking');
          break;
        }
        // 1. The head lifts and the eyes open.
        headLift.set(withSequence(withSpring(1, SPRING.gentle), withDelay(WAKE.land - transition.long, withSpring(0, SPRING.soft))));
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
          paw.set(1);
          reducedTimer = setTimeout(() => settle('reacting'), transition.long * 2);
          break;
        }
        paw.set(
          withSequence(
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

      case 'celebrating':
        to(pose, 1);
        if (R) {
          // still pose: paw up, happy eyes, confetti frozen mid-air
          paw.set(1);
          eyes.set(1);
          confetti.set(0.45);
        }
        break;
    }
    return () => clearTimeout(reducedTimer);
    // Shared values are stable; only state, cue and Reduce Motion restart a transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, cue, reducedMotion]);

  // ----- idle loops: stopped while paused or with Reduce Motion -----
  useEffect(() => {
    const loops = [breath, z1, z2, z3, tailSway, earL, earR, lap];
    if (state === 'sitting' || state === 'reacting') loops.push(eyes);
    if (state === 'celebrating') loops.push(sx, sy, paw, eyes, confetti, jumpY);
    const stopAll = () => loops.forEach((v) => cancelAnimation(v));

    if (paused || reducedMotion) {
      stopAll();
      if (reducedMotion) [breath, tailSway, earL, earR, lap].forEach((v) => v.set(0));
      return;
    }
    const sleeping = state === 'sleeping';

    breathe(breath, breathDepth, sleeping ? AMBIENT.breathSleeping : AMBIENT.breathAwake, AMBIENT.breathDepth);

    if (sleeping) {
      // Three "z"s, each on its own randomised clock, started a beat apart.
      floatLoop(z1, 0, AMBIENT.zGap, AMBIENT.zRise);
      floatLoop(z2, AMBIENT.zGap.max, AMBIENT.zGap, AMBIENT.zRise);
      floatLoop(z3, AMBIENT.zGap.max * 2, AMBIENT.zGap, AMBIENT.zRise);
    }

    const sway = sleeping ? 5 : 10;
    loopWithGaps(tailSway, 0, sleeping ? AMBIENT.tailGapSleeping : AMBIENT.tailGapAwake, () => {
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
    loopWithGaps(earL, 0, AMBIENT.earGap, flick(-1));
    loopWithGaps(earR, 0, AMBIENT.earGap, flick(1));

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

    if (state === 'celebrating') {
      // Crouch (anticipation), stretch up into the air, squash on landing, settle; again after a varied pause.
      function jump(wait: number) {
        'worklet';
        const shape = (axis: 'x' | 'y') =>
          withDelay(
            wait,
            withSequence(
              withTiming(SHAPE.crouch[axis], { duration: CELEBRATE.crouch, easing: EASE.out }),
              withTiming(SHAPE.takeoff[axis], { duration: CELEBRATE.takeoff, easing: EASE.rise }),
              withDelay(CELEBRATE.land - CELEBRATE.crouch - CELEBRATE.takeoff, withTiming(SHAPE.land[axis], { duration: micro.fast, easing: EASE.out })),
              withSpring(1, SPRING.snappy),
            ),
          );
        sx.set(shape('x'));
        sy.set(shape('y'));
        paw.set(withDelay(wait + CELEBRATE.crouch, withSequence(withSpring(1, SPRING.snappy), withDelay(micro.base, withSpring(0, SPRING.soft)))));
        eyes.set(
          withDelay(
            wait + CELEBRATE.crouch,
            withSequence(
              withTiming(1, { duration: micro.fast, easing: EASE.out }),
              withDelay(transition.long - micro.fast, withTiming(0, { duration: micro.fast, easing: EASE.out })),
            ),
          ),
        );
        // The confetti restarts from 0 only once this jump begins, so the last burst finishes falling first.
        confetti.set(withDelay(wait, withSequence(withTiming(0, { duration: 0 }), withDelay(CELEBRATE.crouch, withTiming(1, { duration: DURATION.particle, easing: EASE.rise })))));
        jumpY.set(
          withDelay(
            wait + CELEBRATE.crouch,
            withSequence(
              withTiming(-ARC.jump.height, { duration: ARC.jump.rise, easing: EASE.rise }),
              withTiming(0, { duration: ARC.jump.fall, easing: EASE.fall }, (finished) => {
                if (finished) jump(transition.long + pick(AMBIENT.celebrateGap, Math.random()));
              }),
            ),
          ),
        );
      }
      jump(0);
    }

    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, paused, reducedMotion, cue]);

  // ----- follow-through: ears and tail trail vertical body motion -----
  useAnimatedReaction(
    () => jumpY.get(),
    (y) => followY.set(withSpring(y, SPRING.snappy)),
  );

  // ----- tap: turn the head, or twitch the ears -----
  useEffect(() => {
    if (tapSignal === 0 || reducedMotion) return;
    const flick = (deg: number) => withSequence(withTiming(deg, { duration: micro.fast, easing: EASE.out }), withSpring(0, SPRING.snappy));
    if (stateRef.current === 'sleeping' || tapSignal % 2 === 0) {
      earL.set(flick(-14));
      earR.set(withDelay(micro.fast / 2, flick(14))); // the second ear a beat later
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

  const rigStyle = useAnimatedStyle(() => ({ transform: [{ translateY: jumpY.get() * k }] }));
  const couchStyle = useAnimatedStyle(() => ({ opacity: 1 - pose.get() }));
  const bowlStyle = useAnimatedStyle(() => ({ opacity: bowl.get() }));

  const shadowStyle = useAnimatedStyle(() => {
    const q = pose.get();
    const air = Math.min(1, -jumpY.get() / 70);
    return {
      opacity: 1 - air * 0.5,
      transform: [{ translateY: (1 - q) * 7 * k }, { scaleX: (1 - q * (100 / 220)) * (1 - air * 0.35) }],
    };
  });

  const tailStyle = useAnimatedStyle(() => {
    const q = pose.get();
    return {
      transform: [
        { translateX: T.dx * (1 - q) * k },
        { translateY: T.dy * (1 - q) * k },
        { rotate: `${T.rotate * (1 - q) + tailSway.get() - lag() * FOLLOW.tail}deg` },
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
      breath.get() * 2.5 * breathDepth.get() * q;
    const rot = H.rotate * (1 - lift) * (1 - q) + headTurn.get();
    const scale = H.scale + (1 - H.scale) * q;
    return { transform: [{ translateX: dx * k }, { translateY: dy * k }, { rotate: `${rot}deg` }, { scale }] };
  });

  // Ears fold outward while the body rises and swing back as it lands.
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.get() + lag() * FOLLOW.ear}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.get() - lag() * FOLLOW.ear}deg` }] }));
  const eyesOpenStyle = useAnimatedStyle(() => ({ opacity: 1 - eyes.get() }));
  const eyesClosedStyle = useAnimatedStyle(() => ({ opacity: eyes.get() }));

  const stage: ViewStyle = { ...fill, width: size, height: size };
  const fx = isDark ? MILO_FX.dark : MILO_FX.light;

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
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

      <Animated.View style={[stage, rigStyle]}>
        <Animated.View style={[stage, { transformOrigin: [TAIL_BASE.x * k, TAIL_BASE.y * k, 0] }, tailStyle]}>
          <Layer name="tail" k={k} />
        </Animated.View>
        <Layer name="body-lie" k={k} style={bodyLieStyle} />
        <Layer name="body-sit" k={k} style={bodySitStyle} />
        <Layer name="front-paw" k={k} style={pawStyle} />
        <Animated.View style={[stage, { transformOrigin: [NECK.x * k, NECK.y * k, 0] }, headStyle]}>
          <Layer name="ear-left" k={k} style={earLStyle} />
          <Layer name="ear-right" k={k} style={earRStyle} />
          <Layer name="collar" k={k} />
          <Layer name="head" k={k} />
          <Layer name="eyes-open" k={k} style={eyesOpenStyle} />
          <Layer name="eyes-closed" k={k} style={eyesClosedStyle} />
        </Animated.View>
      </Animated.View>

      <Layer name="bowl" k={k} style={bowlStyle} />

      {[z1, z2, z3].map((z, i) => (
        <Z key={i} progress={z} on={zzOn} k={k} color={fx.z} />
      ))}
      {CONFETTI.map((p, i) => (
        <Particle key={`c${i}`} piece={p} progress={confetti} k={k} origin={{ x: 120, y: 120 }} />
      ))}
      {SPARKS.map((p, i) => (
        <Particle key={`s${i}`} piece={p} progress={sparks} k={k} origin={{ x: 176, y: 122 }} />
      ))}
    </View>
  );
}
