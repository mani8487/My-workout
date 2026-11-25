/**
 * PuppetRenderer: draws Milo as separate paper-puppet layers (layers.ts +
 * placeholder-art.ts) and moves each one around its own pivot with
 * Reanimated. Follows the MiloRenderer contract in types.ts.
 *
 * Two kinds of motion:
 * - Transitions (one effect per state change): pose changes, waking, the
 *   paw-lift reaction.
 * - Idle loops (stopped while paused): breathing, tail sway, blinks, ear
 *   twitches, floating "Zz", lapping water, repeated celebration jumps.
 * With Reduce Motion on, every state is a still pose.
 */
import { memo, useEffect, useRef } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { EASE_IN_OUT, EASE_OUT, SPRING_RELEASE, SPRING_SETTLE } from '@/theme/motion';

import { GROUND_Y, LAYERS, LIE_POSE, NECK, STAGE, TAIL_BASE, type LayerName } from './layers';
import { PLACEHOLDER_ART } from './placeholder-art';
import type { MiloRendererProps, MiloState } from './types';

const MINT = '#A8DCC6';
const MINT_LIGHT = '#CBEBDD';
const MINT_DEEP = '#8FCDB3';

const fill: ViewStyle = { position: 'absolute', left: 0, top: 0 };
const quadOut = Easing.out(Easing.quad);
const quadIn = Easing.in(Easing.quad);
const sine = Easing.inOut(Easing.sin);

/** Runs fn at random intervals between min and max ms. Returns a stop function. */
function every(min: number, max: number, fn: () => void) {
  let t: ReturnType<typeof setTimeout>;
  const tick = () => {
    t = setTimeout(() => {
      fn();
      tick();
    }, min + Math.random() * (max - min));
  };
  tick();
  return () => clearTimeout(t);
}

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
  const colors = [MINT, MINT_LIGHT, MINT_DEEP];
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

// ---------- floating "Zz" ----------

function Z({ i, loop, on, k, color }: { i: number; loop: SharedValue<number>; on: SharedValue<number>; k: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = (loop.get() + i / 3) % 1;
    return {
      opacity: Math.sin(Math.PI * t) * on.get(),
      transform: [{ translateX: t * 20 * k }, { translateY: -t * 40 * k }, { scale: 0.7 + t * 0.5 }],
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
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const jumpY = useSharedValue(0);
  const tailSway = useSharedValue(0);
  const earL = useSharedValue(0);
  const earR = useSharedValue(0);
  const eyes = useSharedValue(state === 'sleeping' || state === 'drinking' ? 1 : 0); // 1 = closed
  const paw = useSharedValue(0);
  const bowl = useSharedValue(state === 'drinking' ? 1 : 0);
  const zzLoop = useSharedValue(0);
  const zzOn = useSharedValue(state === 'sleeping' ? 1 : 0);
  const confetti = useSharedValue(0);
  const sparks = useSharedValue(0);

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
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const settle = (s: MiloState) => settledRef.current(s);
    const to = (v: SharedValue<number>, target: number, cfg = SPRING_SETTLE) => v.set(R ? target : withSpring(target, cfg));
    const fade = (v: SharedValue<number>, target: number, ms = 250) => v.set(R ? target : withTiming(target, { duration: ms, easing: EASE_OUT }));

    fade(zzOn, state === 'sleeping' ? 1 : 0);
    fade(bowl, state === 'drinking' ? 1 : 0);
    to(dip, state === 'drinking' ? 1 : 0);
    if (state !== 'celebrating') confetti.set(0);
    if (state !== 'reacting' && state !== 'celebrating') to(paw, 0);
    if (state !== 'waking') {
      to(jumpY, 0);
      to(sx, 1);
      to(sy, 1);
    }

    switch (state) {
      case 'sleeping':
        to(pose, 0);
        to(headLift, 0);
        fade(eyes, 1, 300);
        break;

      case 'sitting':
        to(pose, 1);
        to(headLift, 0);
        fade(eyes, 0, 160);
        break;

      case 'drinking':
        to(pose, 1);
        fade(eyes, 1, 200);
        break;

      case 'waking': {
        if (R || pose.get() > 0.99) {
          pose.set(1);
          headLift.set(0);
          eyes.set(0);
          settle('waking');
          break;
        }
        // 1. head lifts and the eyes open
        headLift.set(withSpring(1, SPRING_SETTLE));
        eyes.set(withDelay(250, withTiming(0, { duration: 160, easing: EASE_OUT })));
        // 2. stretch, then squash
        sx.set(withDelay(450, withSequence(withTiming(1.12, { duration: 260, easing: EASE_OUT }), withTiming(0.95, { duration: 160, easing: EASE_IN_OUT }), withSpring(1, SPRING_RELEASE))));
        sy.set(withDelay(450, withSequence(withTiming(0.9, { duration: 260, easing: EASE_OUT }), withTiming(1.06, { duration: 160, easing: EASE_IN_OUT }), withSpring(1, SPRING_RELEASE))));
        // 3. one hop arc while the lying pose crossfades into sitting
        jumpY.set(withDelay(1000, withSequence(withTiming(-28, { duration: 240, easing: quadOut }), withTiming(0, { duration: 220, easing: quadIn }))));
        pose.set(withDelay(1000, withTiming(1, { duration: 460, easing: EASE_IN_OUT })));
        later(1460, () => {
          headLift.set(0);
          sy.set(withSequence(withTiming(0.9, { duration: 90, easing: EASE_OUT }), withSpring(1, SPRING_RELEASE)));
          sx.set(withSequence(withTiming(1.08, { duration: 90, easing: EASE_OUT }), withSpring(1, SPRING_RELEASE)));
        });
        later(1900, () => settle('waking'));
        break;
      }

      case 'reacting':
        to(pose, 1);
        fade(eyes, 0, 160);
        if (R) {
          paw.set(1);
          later(1500, () => settle('reacting'));
          break;
        }
        paw.set(withSequence(withSpring(1, SPRING_RELEASE), withDelay(650, withSpring(0, SPRING_SETTLE))));
        sparks.set(0);
        sparks.set(withDelay(120, withTiming(1, { duration: 700, easing: EASE_OUT })));
        later(1500, () => settle('reacting'));
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
    return () => timers.forEach(clearTimeout);
    // Shared values are stable; only state, cue and Reduce Motion restart a transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, cue, reducedMotion]);

  // ----- idle loops: stopped while paused or with Reduce Motion -----
  useEffect(() => {
    const loops = [breath, zzLoop, lap];
    if (paused || reducedMotion) {
      loops.forEach((v) => cancelAnimation(v));
      return;
    }
    const stops: (() => void)[] = [];
    const sleeping = state === 'sleeping';

    breath.set(
      withSequence(
        withTiming(0, { duration: 300 }),
        withRepeat(withTiming(1, { duration: sleeping ? 2400 : 1700, easing: sine }), -1, true),
      ),
    );

    if (sleeping) zzLoop.set(withRepeat(withTiming(zzLoop.get() + 1, { duration: 3600, easing: Easing.linear }), -1, false));

    const sway = sleeping ? 5 : 10;
    stops.push(
      every(sleeping ? 7000 : 4000, sleeping ? 12000 : 8000, () =>
        tailSway.set(
          withSequence(
            withTiming(sway, { duration: 500, easing: EASE_IN_OUT }),
            withTiming(-sway * 0.6, { duration: 600, easing: EASE_IN_OUT }),
            withSpring(0, SPRING_SETTLE),
          ),
        ),
      ),
    );

    stops.push(
      every(6000, 12000, () => {
        const left = Math.random() < 0.5;
        (left ? earL : earR).set(withSequence(withTiming(left ? -14 : 14, { duration: 70 }), withSpring(0, SPRING_RELEASE)));
      }),
    );

    if (state === 'sitting' || state === 'reacting') {
      stops.push(
        every(3000, 6000, () => {
          if (stateRef.current === 'sitting' || stateRef.current === 'reacting')
            eyes.set(withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 })));
        }),
      );
    }

    if (state === 'drinking') {
      const lick = () => withSequence(withTiming(1, { duration: 200, easing: EASE_OUT }), withTiming(0, { duration: 220, easing: EASE_IN_OUT }));
      lap.set(withRepeat(withSequence(withDelay(700, lick()), lick(), lick()), -1, false));
    } else {
      lap.set(withTiming(0, { duration: 150 }));
    }

    if (state === 'celebrating') {
      const jump = () => {
        // crouch, stretch up into the air, squash on landing, settle
        sy.set(withSequence(withTiming(0.9, { duration: 140, easing: EASE_OUT }), withTiming(1.06, { duration: 200 }), withDelay(360, withTiming(0.86, { duration: 90 })), withSpring(1, SPRING_RELEASE)));
        sx.set(withSequence(withTiming(1.06, { duration: 140, easing: EASE_OUT }), withTiming(0.97, { duration: 200 }), withDelay(360, withTiming(1.12, { duration: 90 })), withSpring(1, SPRING_RELEASE)));
        jumpY.set(withDelay(140, withSequence(withTiming(-58, { duration: 300, easing: quadOut }), withTiming(0, { duration: 280, easing: quadIn }))));
        paw.set(withDelay(140, withSequence(withSpring(1, SPRING_RELEASE), withDelay(380, withSpring(0, SPRING_SETTLE)))));
        eyes.set(withDelay(140, withSequence(withTiming(1, { duration: 80 }), withDelay(700, withTiming(0, { duration: 120 })))));
        confetti.set(0);
        confetti.set(withDelay(160, withTiming(1, { duration: 1300, easing: quadOut })));
      };
      jump();
      stops.push(every(2600, 2600, jump));
    }

    return () => {
      stops.forEach((s) => s());
      loops.forEach((v) => cancelAnimation(v));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, paused, reducedMotion, cue]);

  // ----- tap: turn the head, or twitch the ears -----
  useEffect(() => {
    if (tapSignal === 0 || reducedMotion) return;
    const twitch = () => {
      earL.set(withSequence(withTiming(-14, { duration: 70 }), withSpring(0, SPRING_RELEASE)));
      earR.set(withSequence(withDelay(60, withTiming(14, { duration: 70 })), withSpring(0, SPRING_RELEASE)));
    };
    if (stateRef.current === 'sleeping' || tapSignal % 2 === 0) twitch();
    else headTurn.set(withSequence(withTiming(9, { duration: 180, easing: EASE_OUT }), withDelay(250, withSpring(0, SPRING_RELEASE))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapSignal]);

  // ----- styles -----
  const H = LIE_POSE.head;
  const T = LIE_POSE.tail;
  const amp = (q: number) => {
    'worklet';
    return 0.03 - 0.012 * q;
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
        { rotate: `${T.rotate * (1 - q) + tailSway.get()}deg` },
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
      breath.get() * 2.5 * q;
    const rot = H.rotate * (1 - lift) * (1 - q) + headTurn.get();
    const scale = H.scale + (1 - H.scale) * q;
    return { transform: [{ translateX: dx * k }, { translateY: dy * k }, { rotate: `${rot}deg` }, { scale }] };
  });

  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.get()}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.get()}deg` }] }));
  const eyesOpenStyle = useAnimatedStyle(() => ({ opacity: 1 - eyes.get() }));
  const eyesClosedStyle = useAnimatedStyle(() => ({ opacity: eyes.get() }));

  const stage: ViewStyle = { ...fill, width: size, height: size };
  const shadowColor = isDark ? 'rgba(0,0,0,0.38)' : 'rgba(40,56,74,0.16)';
  const zColor = isDark ? '#AAB6C6' : '#616E80';

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
            backgroundColor: shadowColor,
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

      {[0, 1, 2].map((i) => (
        <Z key={i} i={i} loop={zzLoop} on={zzOn} k={k} color={zColor} />
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
