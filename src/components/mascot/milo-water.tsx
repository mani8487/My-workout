/**
 * Water on Milo: the fill inside him (Home), drawn between his fur colour and
 * his markings, plus the motion around it. All on the UI thread.
 *
 * - The level springs to each new value; on the first open of the day it
 *   catches up from what you last saw.
 * - A drink pours in from above (a short stream), the surface sloshes and
 *   settles, a few bubbles drift up.
 * - Awake, Milo reacts in a staggered beat: ears perk as the water rises, a
 *   happy blink, a tail flick that lags behind, then a quick lap and lick with
 *   a small lift before it (anticipation) and a soft settle after.
 *   Asleep, only the water moves (it breathes with him, inside his curl).
 * - At the goal a shimmer sweeps across him with two or three sparkles.
 * - Behind pace he may glance at his bowl (never sad; Home decides when).
 * With Reduce Motion the level changes at once and nothing else plays.
 */
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect, SvgXml } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { DURATION, EASE, SPRING, WATER } from '@/motion';

import { LAYERS, type LayerName } from './layers';
import { LIQUID_OPACITY, MILO_ART } from './palette';
import type { MiloState, MiloWater } from './types';
import { WATER_ART, type FurShape } from './water-art';
import { BUBBLES, bubbleAt, EMPTY_PATH, FRAME_OF, pourPath, pourSegment, shimmerPath, waterPaths, type WaterPose } from './water-geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const { micro, transition } = DURATION;
const fill: ViewStyle = { position: 'absolute', left: 0, top: 0 };

/** States in which Milo is up and free to react to a drink (not asleep, not mid-move). */
const REACTS: readonly MiloState[] = ['sitting', 'content', 'reacting'];

/** Everything a water layer reads. `place` is how Milo is posed (from the renderer). */
export type WaterCtx = {
  level: SharedValue<number>;
  slosh1: SharedValue<number>;
  slosh2: SharedValue<number>;
  pour: SharedValue<number>;
  bubbles: SharedValue<number>;
  shimmer: SharedValue<number>;
  place: SharedValue<WaterPose>;
  /** The same, without the head and ears: body and paw layers don't redraw when he flicks an ear. */
  bodyPlace: SharedValue<WaterPose>;
  reduced: boolean;
};

const busy = (v: SharedValue<number>) => v.get() > 0 && v.get() < 1;

/**
 * The water's shared values and its one-shots. `water` undefined = the feature is off: every value
 * stays at rest (0), so the renderer draws Milo exactly as before.
 */
export function useWaterMotion(water: MiloWater | undefined, state: MiloState, reducedMotion: boolean) {
  const target = water?.level ?? 0;
  const start = water?.from ?? target;
  const level = useSharedValue(start);
  const slosh1 = useSharedValue(0); // two sloshes, so a second drink close behind never cuts the first off
  const slosh2 = useSharedValue(0);
  const pour = useSharedValue(0);
  const bubbles = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const sparkle = useSharedValue(0);
  // Milo's reaction (added on top of his own motion, so nothing he is doing is interrupted).
  const happy = useSharedValue(0); // eyes closed happily, 0..1
  const tailFlick = useSharedValue(0); // degrees
  const lick = useSharedValue(0); // the lap: -0.4 (small lift) .. 1 (dipped, tongue out)
  const earL = useSharedValue(0); // degrees
  const earR = useSharedValue(0);
  const glance = useSharedValue(0); // 0..1, looking down at his bowl
  const bowl = useSharedValue(0); // the bowl showing for the glance

  // Water layers are only drawn once there is (or was) water; until then Milo is his usual layers.
  const [wet, setWet] = useState(start > 0 || target > 0);
  if (water && target > 0 && !wet) setWet(true);
  // With Reduce Motion an undo to empty is instant, so the plain layers come straight back.
  if (reducedMotion && target <= 0 && wet) setWet(false);

  const all = useRef([level, slosh1, slosh2, pour, bubbles, shimmer, sparkle, happy, tailFlick, lick, earL, earR, glance, bowl]);
  useEffect(() => {
    const values = all.current;
    return () => values.forEach((v) => cancelAnimation(v));
  }, []);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ----- the level -----
  const first = useRef(true);
  const lastDrink = useRef(water?.drinkCue ?? 0);
  const drinkCue = water?.drinkCue ?? 0;
  useEffect(() => {
    if (!water) return;
    const catchUp = first.current;
    first.current = false;
    const drank = drinkCue !== lastDrink.current;
    lastDrink.current = drinkCue;
    if (reducedMotion) {
      cancelAnimation(level);
      level.set(target);
      return;
    }
    // Once it has drained back to empty (an undo), Milo goes back to his plain layers.
    const drained = (finished?: boolean) => {
      'worklet';
      if (finished && target <= 0) scheduleOnRN(setWet, false);
    };
    const asleep = stateRef.current === 'sleeping' || stateRef.current === 'stirring';
    if (catchUp) {
      if (Math.abs(level.get() - target) < 0.001) return;
      // First open of the day: a calm catch-up from what you last saw, with the room.
      level.set(withDelay(micro.slow + micro.fast, withTiming(target, { duration: transition.long, easing: EASE.inOut }, drained)));
    } else if (asleep) {
      // Asleep: the water rises slowly and softly; he doesn't stir.
      level.set(withDelay(drank ? WATER.pourLand : 0, withTiming(target, { duration: transition.long, easing: EASE.breathe }, drained)));
    } else {
      level.set(withDelay(drank ? WATER.pourLand : 0, withSpring(target, SPRING.gentle, drained)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, drinkCue, reducedMotion]);

  const goalCue = water?.goalCue ?? 0;
  const seenGoal = useRef(goalCue);

  // ----- a drink: pour, slosh, bubbles, and his reaction -----
  const seenDrink = useRef(drinkCue);
  useEffect(() => {
    if (!water || drinkCue === seenDrink.current) return;
    seenDrink.current = drinkCue;
    if (reducedMotion) return;
    // A pour or bubbles already under way carry on (never cut off); a new slosh takes a free channel
    // (with both busy, the older one, which has nearly died away, restarts).
    if (!busy(pour)) {
      pour.set(0);
      pour.set(withTiming(1, { duration: WATER.pour, easing: EASE.breathe }));
    }
    const slosh = !busy(slosh1) ? slosh1 : !busy(slosh2) ? slosh2 : slosh1.get() > slosh2.get() ? slosh1 : slosh2;
    if (busy(slosh)) {
      // Both still moving (a third quick drink): ease the older one back to its swell instead of a jump.
      slosh.set(withSequence(withTiming(0.1, { duration: micro.fast, easing: EASE.out }), withTiming(1, { duration: WATER.slosh, easing: EASE.breathe })));
    } else {
      slosh.set(0);
      slosh.set(withDelay(WATER.pourLand, withTiming(1, { duration: WATER.slosh, easing: EASE.breathe })));
    }
    if (!busy(bubbles)) {
      bubbles.set(0);
      bubbles.set(withDelay(WATER.pourLand + micro.fast, withTiming(1, { duration: WATER.bubbles, easing: EASE.breathe })));
    }
    if (!REACTS.includes(stateRef.current)) return; // asleep or busy: only the water moves

    // Ears perk outward as the water rises, the second a beat after the first, then settle.
    const perk = (deg: number) => withSequence(withTiming(deg, { duration: micro.base, easing: EASE.out }), withSpring(0, SPRING.soft));
    earL.set(withDelay(WATER.ears, perk(-7)));
    earR.set(withDelay(WATER.ears + micro.fast / 2, perk(7)));
    // A happy blink: the eyes close softly, linger, and open.
    happy.set(
      withDelay(
        WATER.blink,
        withSequence(withTiming(1, { duration: micro.base, easing: EASE.out }), withDelay(WATER.blinkHold, withTiming(0, { duration: micro.slow, easing: EASE.inOut }))),
      ),
    );
    // A small tail flick that trails the rest: out, a little back past rest, and a slow settle.
    tailFlick.set(
      withDelay(
        WATER.tail,
        withSequence(
          withTiming(12, { duration: micro.slow, easing: EASE.out }),
          withTiming(-5, { duration: transition.short, easing: EASE.inOut }),
          withSpring(0, SPRING.gentle),
        ),
      ),
    );
    // The drink that reaches the goal gets his paw lift instead (after the shimmer), so no lap here.
    if (goalCue !== seenGoal.current) return;
    // A quick lap and lick: a tiny lift first (anticipation), two laps, a soft settle.
    lick.set(
      withDelay(
        WATER.lap,
        withSequence(
          withTiming(-0.4, { duration: micro.fast, easing: EASE.inOut }),
          withTiming(1, { duration: micro.base, easing: EASE.out }),
          withTiming(0.15, { duration: micro.base, easing: EASE.inOut }),
          withTiming(1, { duration: micro.base, easing: EASE.out }),
          withSpring(0, SPRING.soft),
        ),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinkCue]);

  // ----- the goal: a shimmer and sparkles -----
  useEffect(() => {
    if (!water || goalCue === seenGoal.current) return;
    seenGoal.current = goalCue;
    if (reducedMotion) return;
    // After the level has risen to the top (it rises more slowly while he sleeps).
    const after = WATER.pourLand + transition.long;
    shimmer.set(0);
    shimmer.set(withDelay(after, withTiming(1, { duration: WATER.shimmer, easing: EASE.inOut })));
    sparkle.set(0);
    sparkle.set(withDelay(after, withTiming(1, { duration: WATER.shimmer + transition.short, easing: EASE.breathe })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalCue]);

  // ----- behind pace: a glance at his bowl -----
  const glanceCue = water?.glanceCue ?? 0;
  const seenGlance = useRef(glanceCue);
  useEffect(() => {
    if (!water || glanceCue === seenGlance.current) return;
    seenGlance.current = glanceCue;
    // Only while he's sitting up with open eyes, so the look reads as interest.
    if (reducedMotion || stateRef.current !== 'sitting') return;
    // The bowl appears, he looks down at it with interest, looks back up, and it fades away.
    bowl.set(
      withSequence(
        withTiming(1, { duration: transition.short, easing: EASE.out }),
        withDelay(WATER.glanceHold + transition.base, withTiming(0, { duration: transition.base, easing: EASE.inOut })),
      ),
    );
    glance.set(
      withDelay(
        micro.base,
        withSequence(
          withTiming(1, { duration: transition.base, easing: EASE.inOut }),
          withDelay(WATER.glanceHold, withTiming(0, { duration: transition.base, easing: EASE.inOut })),
        ),
      ),
    );
    // A small, curious tail swish while he looks.
    tailFlick.set(withDelay(transition.base, withSequence(withTiming(6, { duration: transition.base, easing: EASE.inOut }), withSpring(0, SPRING.gentle))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glanceCue]);

  return { wet: !!water && wet, level, slosh1, slosh2, pour, bubbles, shimmer, sparkle, happy, tailFlick, lick, earL, earR, glance, bowl };
}

/** What the water layers read, once there is water (undefined before: Milo draws his usual layers). */
export function useWaterCtx(wm: ReturnType<typeof useWaterMotion>, place: SharedValue<WaterPose>, bodyPlace: SharedValue<WaterPose>, reduced: boolean): WaterCtx | undefined {
  const { wet, level, slosh1, slosh2, pour, bubbles, shimmer } = wm;
  return useMemo(
    () => (wet ? { level, slosh1, slosh2, pour, bubbles, shimmer, place, bodyPlace, reduced } : undefined),
    [wet, level, slosh1, slosh2, pour, bubbles, shimmer, place, bodyPlace, reduced],
  );
}

// ---------- drawing ----------

function FurClip({ shape }: { shape: FurShape }) {
  switch (shape.kind) {
    case 'path':
      return <Path d={shape.d} />;
    case 'rect':
      return <Rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
    case 'ellipse':
      return <Ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />;
  }
}

function Bubble({ name, i, w }: { name: LayerName; i: number; w: WaterCtx }) {
  const frame = FRAME_OF[name] ?? 'body';
  const props = useAnimatedProps(() => {
    const b = bubbleAt(name, frame, w.bodyPlace.get(), w.level.get(), i, w.bubbles.get());
    return { cx: b.cx, cy: b.cy, rx: b.r, ry: b.r, opacity: b.opacity };
  });
  return <AnimatedEllipse animatedProps={props} fill={MILO_ART.liquidSurface} fillOpacity={0.55} stroke={MILO_ART.liquidSurface} strokeWidth={0.8} />;
}

/** The water above one fur shape, clipped to it. */
function Liquid({ name, shape, main, k, w }: { name: LayerName; shape: FurShape; main: boolean; k: number; w: WaterCtx }) {
  const b = LAYERS[name];
  const frame = FRAME_OF[name] ?? 'body';
  const clipId = `fur${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Rebuilt only when the level, the pose or one of his moves, or a slosh changes; never while he just breathes.
  // A body layer that is faded out (lying while he sits, or the other way round) skips the work.
  const place = frame === 'head' ? w.place : w.bodyPlace;
  const paths = useDerivedValue(() => {
    const p = place.get();
    if ((name === 'body-lie' && p.q > 0.999) || (name !== 'body-lie' && frame !== 'head' && p.q < 0.001)) return { body: EMPTY_PATH, surface: EMPTY_PATH };
    return waterPaths(name, frame, p, w.level.get(), w.slosh1.get(), w.slosh2.get());
  });
  const bodyProps = useAnimatedProps(() => ({ d: paths.get().body }));
  const surfaceProps = useAnimatedProps(() => ({ d: paths.get().surface }));
  const pourProps = useAnimatedProps(() => ({ d: w.reduced ? EMPTY_PATH : pourPath(name, frame, place.get(), w.level.get(), w.pour.get()) }));
  const shimmerProps = useAnimatedProps(() => ({ d: w.reduced ? EMPTY_PATH : shimmerPath(name, frame, place.get(), w.shimmer.get()) }));
  const bubbly = main && !w.reduced && (name === 'body-sit' || name === 'body-lie');
  return (
    <Svg width={b.w * k} height={b.h * k} viewBox={`0 0 ${b.w} ${b.h}`} style={fill}>
      <Defs>
        <ClipPath id={clipId}>
          <FurClip shape={shape} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <AnimatedPath animatedProps={bodyProps} fill={MILO_ART.liquid} fillOpacity={LIQUID_OPACITY} />
        <AnimatedPath animatedProps={pourProps} fill={MILO_ART.liquid} fillOpacity={0.3} />
        {bubbly && BUBBLES.map((_, i) => <Bubble key={i} name={name} i={i} w={w} />)}
        {main && <AnimatedPath animatedProps={shimmerProps} fill="#FFFFFF" fillOpacity={0.32} />}
        <AnimatedPath animatedProps={surfaceProps} fill="none" stroke={MILO_ART.liquidSurface} strokeWidth={1.6} strokeOpacity={0.95} />
      </G>
    </Svg>
  );
}

const ArtPiece = memo(function ArtPiece({ xml, w, h }: { xml: string; w: number; h: number }) {
  return <SvgXml xml={xml} width={w} height={h} style={fill} />;
});

/** A furry layer with water inside: its art in parts, the water between the fur colour and the markings. */
export function WaterLayerArt({ name, k, w }: { name: LayerName; k: number; w: WaterCtx }) {
  const b = LAYERS[name];
  return (
    <View style={{ width: b.w * k, height: b.h * k }}>
      {WATER_ART[name].map((piece, i) =>
        piece.type === 'art' ? <ArtPiece key={i} xml={piece.xml} w={b.w * k} h={b.h * k} /> : <Liquid key={i} name={name} shape={piece.shape} main={piece.main} k={k} w={w} />,
      )}
    </View>
  );
}

// ---------- the lick, and the goal sparkles ----------

/** Stage box of the tongue, just under the mouth (it belongs to the head group). */
const TONGUE = { x: 116.5, y: 102, w: 7, h: 6 };

export function Tongue({ lick, k }: { lick: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (lick.get() - 0.1) / 0.9));
    return { opacity: Math.min(1, t * 3), transform: [{ scaleY: t }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: TONGUE.x * k,
          top: TONGUE.y * k,
          width: TONGUE.w * k,
          height: TONGUE.h * k,
          borderBottomLeftRadius: (TONGUE.w * k) / 2,
          borderBottomRightRadius: (TONGUE.w * k) / 2,
          borderTopLeftRadius: k,
          borderTopRightRadius: k,
          backgroundColor: MILO_ART.pink,
          borderWidth: Math.max(0.5, 1.1 * k),
          borderColor: MILO_ART.line,
          transformOrigin: 'top',
        },
        style,
      ]}
    />
  );
}

/** Two or three twinkles around his head at the goal (stage points, size, and when each peaks in 0..1). */
const SPARKLES = [
  { x: 56, y: 52, size: 14, at: 0.3 },
  { x: 186, y: 40, size: 11, at: 0.5 },
  { x: 168, y: 98, size: 9, at: 0.68 },
] as const;
const STAR = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z';

/** Lying, his head is lower and to the left: the sparkles move with it. */
const SPARKLE_LIE = { dx: -42, dy: 52 };

function Sparkle({ s, t, k, place }: { s: (typeof SPARKLES)[number]; t: SharedValue<number>; k: number; place: SharedValue<WaterPose> }) {
  const style = useAnimatedStyle(() => {
    const u = Math.max(0, 1 - Math.abs(t.get() - s.at) / 0.3); // each one swells and fades around its moment
    const e = u * u * (3 - 2 * u);
    const lying = 1 - place.get().q;
    return {
      opacity: e,
      transform: [{ translateX: SPARKLE_LIE.dx * lying * k }, { translateY: SPARKLE_LIE.dy * lying * k }, { scale: 0.4 + 0.6 * e }, { rotate: `${t.get() * 40}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (s.x - s.size / 2) * k, top: (s.y - s.size / 2) * k, width: s.size * k, height: s.size * k }, style]}>
      <Svg width={s.size * k} height={s.size * k} viewBox="0 0 24 24">
        <Path d={STAR} fill={MILO_ART.liquid} />
      </Svg>
    </Animated.View>
  );
}

export function WaterSparkles({ t, k, place }: { t: SharedValue<number>; k: number; place: SharedValue<WaterPose> }) {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} s={s} t={t} k={k} place={place} />
      ))}
    </>
  );
}

const STREAM_W = 4.5;
/** The stream fades in over its first few stage units, so it doesn't appear from nowhere. */
const STREAM_FADE = 14;

/**
 * The visible part of the pour: a thin stream falling from above onto the top of his head (inside him
 * it carries on only faintly, behind his muzzle and chest). Moves with him (it lives in his rig).
 */
export function PourStream({ ctx, k }: { ctx: WaterCtx; k: number }) {
  // Height (not a scale) carries the length, so the ends stay round. Only during a pour (about half a second).
  const style = useAnimatedStyle(() => {
    const s = pourSegment(ctx.level.get(), ctx.bodyPlace.get().q, ctx.pour.get());
    const bottom = Math.min(s.head, s.headTop + 3);
    const len = bottom - s.tail;
    if (s.w <= 0 || len <= 0.5) return { opacity: 0, height: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }] };
    return {
      opacity: 0.8 * Math.min(1, len / STREAM_FADE),
      height: len * k,
      transform: [{ translateX: (s.x - 120) * k }, { translateY: s.tail * k }, { scaleX: s.w / STREAM_W }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (120 - STREAM_W / 2) * k,
          top: 0,
          width: STREAM_W * k,
          borderRadius: (STREAM_W / 2) * k,
          backgroundColor: MILO_ART.liquid,
        },
        style,
      ]}
    />
  );
}
