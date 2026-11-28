/**
 * The furniture of the Living Home room. Static drawings are memoised SVG;
 * anything that moves is an Animated.View driven by shared values on the UI
 * thread (the room's `stage`, today's `water` level and outdoor `day`light).
 *
 * All positions are in room units on a 360 x 240 stage; `k` scales them to
 * points. Ambient motion (curtain sway, leaves, lamp glow, dust) runs only
 * while `live` is true and is cancelled when it turns false or on unmount.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, Polygon, RadialGradient, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { AMBIENT, DURATION, EASE, SPRING, floatLoop, loopWithGaps, pick } from '@/motion';
import { curtainsOpen, DUST_MAX, lampOn, moteOpacity } from '@/logic/scene-state';

import { clearOf, type RoomPalette } from './palette';

export const ROOM = { w: 360, h: 240, floorY: 226 } as const;
const WIN = { x: 34, y: 14, w: 100, h: 104 } as const;
const SILL = { x: WIN.x - 8, y: WIN.y + WIN.h, w: WIN.w + 16, h: 6 } as const;
const LAMP = { x: 304, w: 44 } as const;
const PLANT = { x: 4, w: 56, h: 80 } as const;

type Live = { k: number; live: boolean };
const REST = { duration: DURATION.micro.base, easing: EASE.out };
const box = (x: number, y: number, w: number, h: number, k: number): ViewStyle => ({
  position: 'absolute',
  left: x * k,
  top: y * k,
  width: w * k,
  height: h * k,
});

// ---------- window: sky, frame, sill ----------

export const RoomWindow = memo(function RoomWindow({ k, day, palette }: { k: number; day: SharedValue<number>; palette: RoomPalette }) {
  const dayStyle = useAnimatedStyle(() => ({ opacity: day.get() }));
  return (
    <View pointerEvents="none" style={box(WIN.x, WIN.y, WIN.w, WIN.h, k)}>
      <LinearGradient colors={palette.skyNight} style={{ position: 'absolute', inset: 0 }} />
      <Animated.View style={[{ position: 'absolute', inset: 0 }, dayStyle]}>
        <LinearGradient colors={palette.skyDay} style={{ flex: 1 }} />
      </Animated.View>
      <Svg width={WIN.w * k} height={WIN.h * k} viewBox={`0 0 ${WIN.w} ${WIN.h}`} style={{ position: 'absolute' }}>
        <Rect x={2} y={2} width={WIN.w - 4} height={WIN.h - 4} fill="none" stroke={palette.frame} strokeWidth={4} />
        <Path d={`M${WIN.w / 2} 2 V${WIN.h - 2} M2 ${WIN.h / 2} H${WIN.w - 2}`} stroke={palette.frame} strokeWidth={3} />
      </Svg>
    </View>
  );
});

export const Sill = memo(function Sill({ k, palette }: { k: number; palette: RoomPalette }) {
  return <View pointerEvents="none" style={[box(SILL.x, SILL.y, SILL.w, SILL.h, k), { backgroundColor: palette.sill, borderRadius: 2 * k }]} />;
});

// ---------- light rays from the window onto the floor ----------

export const Rays = memo(function Rays({ k, stage, day, palette }: { k: number; stage: SharedValue<number>; day: SharedValue<number>; palette: RoomPalette }) {
  const style = useAnimatedStyle(() => {
    // Wider curtains let more light in; less of it at night.
    const open = (curtainsOpen(stage.get()) - 0.25) / 0.75;
    return { opacity: open * (0.2 + 0.8 * day.get()) * 0.55 };
  });
  return (
    <Animated.View pointerEvents="none" style={[box(0, 0, ROOM.w, ROOM.h, k), style]}>
      <Svg width={ROOM.w * k} height={ROOM.h * k} viewBox={`0 0 ${ROOM.w} ${ROOM.h}`}>
        <Defs>
          <SvgGradient id="ray" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.ray} stopOpacity={0.9} />
            <Stop offset="1" stopColor={palette.ray} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Polygon points={`${WIN.x + 14},${WIN.y + 20} ${WIN.x + 44},${WIN.y + 14} 210,${ROOM.floorY} 150,${ROOM.floorY}`} fill="url(#ray)" />
        <Polygon points={`${WIN.x + 56},${WIN.y + 12} ${WIN.x + 86},${WIN.y + 18} 270,${ROOM.floorY} 222,${ROOM.floorY}`} fill="url(#ray)" />
      </Svg>
    </Animated.View>
  );
});

// ---------- curtains ----------

const CurtainPanel = memo(function CurtainPanel({ k, side, stage, live, palette }: Live & { side: 'left' | 'right'; stage: SharedValue<number>; palette: RoomPalette }) {
  const w = WIN.w / 2 + 8;
  const h = WIN.h + 16;
  const x = side === 'left' ? WIN.x - 8 : WIN.x + WIN.w / 2;
  const sway = useSharedValue(0);
  const dir = side === 'left' ? 1 : -1;

  useEffect(() => {
    if (!live) {
      sway.set(withTiming(0, REST)); // settle, so nothing stays tilted while paused or with Reduce Motion
      return;
    }
    loopWithGaps(sway, 0, AMBIENT.curtainGap, () => {
      'worklet';
      const a = dir * (0.6 + Math.random() * 0.8);
      return withSequence(
        withTiming(a, { duration: pick(AMBIENT.swayTime, Math.random()), easing: EASE.inOut }),
        withTiming(-a * 0.4, { duration: pick(AMBIENT.swayTime, Math.random()), easing: EASE.inOut }),
        withSpring(0, SPRING.gentle),
      );
    });
    return () => cancelAnimation(sway);
  }, [live, sway, dir]);

  const style = useAnimatedStyle(() => {
    // Each panel covers (1 - open) of its half: 60% at rest (curtains 40% open), bunched to the edge when fully open.
    const cover = Math.max(0.16, 1 - curtainsOpen(stage.get()));
    return { transform: [{ scaleX: cover }, { rotate: `${sway.get()}deg` }] };
  });

  const folds = [0.25, 0.5, 0.75];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        box(x, WIN.y - 6, w, h, k),
        {
          transformOrigin: [side === 'left' ? 0 : w * k, 0, 0],
          backgroundColor: palette.curtain,
          borderBottomLeftRadius: 6 * k,
          borderBottomRightRadius: 6 * k,
        },
        style,
      ]}>
      {folds.map((f) => (
        <View key={f} style={{ position: 'absolute', left: f * w * k, top: 0, bottom: 0, width: 2 * k, backgroundColor: palette.curtainFold }} />
      ))}
    </Animated.View>
  );
});

export const Curtains = memo(function Curtains(props: Live & { stage: SharedValue<number>; palette: RoomPalette }) {
  return (
    <>
      <CurtainPanel {...props} side="left" />
      <CurtainPanel {...props} side="right" />
      <View
        pointerEvents="none"
        style={[box(WIN.x - 14, WIN.y - 9, WIN.w + 28, 4, props.k), { backgroundColor: props.palette.rod, borderRadius: 2 * props.k }]}
      />
    </>
  );
});

// ---------- floor lamp with its warm glow ----------

export const Lamp = memo(function Lamp({ k, stage, day, live, palette }: Live & { stage: SharedValue<number>; day: SharedValue<number>; palette: RoomPalette }) {
  const swell = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      swell.set(withTiming(0, REST));
      return;
    }
    loopWithGaps(swell, 0, AMBIENT.glowGap, () => {
      'worklet';
      const d = pick(AMBIENT.glowSwell, Math.random());
      return withSequence(withTiming(1, { duration: d, easing: EASE.breathe }), withTiming(0, { duration: d, easing: EASE.breathe }));
    });
    return () => cancelAnimation(swell);
  }, [live, swell]);

  const lit = useAnimatedStyle(() => ({ opacity: lampOn(stage.get()) }));
  // The glow reads stronger at night; it breathes by a few percent so it never looks switched-off-still.
  const glow = useAnimatedStyle(() => ({ opacity: lampOn(stage.get()) * (0.45 + 0.4 * (1 - day.get())) * (0.94 + 0.06 * swell.get()) }));

  const glowSize = 150;
  const shade = `M6 0 H${LAMP.w - 6} L${LAMP.w} 26 H0 Z`;
  return (
    <>
      <Animated.View pointerEvents="none" style={[box(LAMP.x + LAMP.w / 2 - glowSize / 2, 52 - glowSize / 2, glowSize, glowSize, k), glow]}>
        <Svg width={glowSize * k} height={glowSize * k} viewBox={`0 0 ${glowSize} ${glowSize}`}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={palette.lampGlow} stopOpacity={0.75} />
              <Stop offset="0.45" stopColor={palette.lampGlow} stopOpacity={0.25} />
              <Stop offset="1" stopColor={palette.lampGlow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={glowSize} height={glowSize} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={box(LAMP.x, 40, LAMP.w, ROOM.floorY - 40, k)}>
        <Svg width={LAMP.w * k} height={(ROOM.floorY - 40) * k} viewBox={`0 0 ${LAMP.w} ${ROOM.floorY - 40}`}>
          <Rect x={LAMP.w / 2 - 1.5} y={24} width={3} height={ROOM.floorY - 40 - 30} fill={palette.lampPole} />
          <Ellipse cx={LAMP.w / 2} cy={ROOM.floorY - 44} rx={13} ry={3.5} fill={palette.lampPole} />
          <Path d={shade} fill={palette.lampShade} />
        </Svg>
      </View>
      <Animated.View pointerEvents="none" style={[box(LAMP.x, 40, LAMP.w, 26, k), lit]}>
        <Svg width={LAMP.w * k} height={26 * k} viewBox={`0 0 ${LAMP.w} 26`}>
          <Path d={shade} fill={palette.lampShadeLit} />
        </Svg>
      </Animated.View>
    </>
  );
});

// ---------- potted plant ----------

export const Plant = memo(function Plant({ k, live, palette }: Live & { palette: RoomPalette }) {
  const sway = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      sway.set(withTiming(0, REST)); // settle, so nothing stays tilted while paused or with Reduce Motion
      return;
    }
    loopWithGaps(sway, 0, AMBIENT.plantGap, () => {
      'worklet';
      const a = 0.8 + Math.random() * 0.9;
      return withSequence(
        withTiming(a, { duration: pick(AMBIENT.swayTime, Math.random()), easing: EASE.inOut }),
        withTiming(-a * 0.5, { duration: pick(AMBIENT.swayTime, Math.random()), easing: EASE.inOut }),
        withSpring(0, SPRING.gentle),
      );
    });
    return () => cancelAnimation(sway);
  }, [live, sway]);

  const potH = 26;
  const leavesH = PLANT.h - potH + 6;
  const top = ROOM.floorY - PLANT.h;
  const leaves = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get()}deg` }] }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[box(PLANT.x, top, PLANT.w, leavesH, k), { transformOrigin: [(PLANT.w / 2) * k, leavesH * k, 0] }, leaves]}>
        <Svg width={PLANT.w * k} height={leavesH * k} viewBox={`0 0 ${PLANT.w} ${leavesH}`}>
          <Path d={`M28 ${leavesH} C 18 40, 6 30, 4 14 C 16 18, 26 30, 28 ${leavesH} Z`} fill={palette.leafDeep} />
          <Path d={`M28 ${leavesH} C 38 40, 52 34, 54 18 C 40 20, 30 32, 28 ${leavesH} Z`} fill={palette.leafDeep} />
          <Path d={`M28 ${leavesH} C 20 34, 20 14, 28 0 C 36 14, 36 34, 28 ${leavesH} Z`} fill={palette.leaf} />
          <Path d={`M28 ${leavesH} C 24 44, 12 44, 8 34 C 18 32, 26 40, 28 ${leavesH} Z`} fill={palette.leaf} />
          <Path d={`M28 ${leavesH} C 32 44, 44 46, 50 38 C 40 34, 30 40, 28 ${leavesH} Z`} fill={palette.leaf} />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={box(PLANT.x + 12, ROOM.floorY - potH, PLANT.w - 24, potH, k)}>
        <Svg width={(PLANT.w - 24) * k} height={potH * k} viewBox={`0 0 ${PLANT.w - 24} ${potH}`}>
          <Path d={`M2 6 H${PLANT.w - 26} L${PLANT.w - 29} ${potH} H5 Z`} fill={palette.pot} />
          <Rect x={0} y={2} width={PLANT.w - 24} height={6} rx={2} fill={palette.potRim} />
        </Svg>
      </View>
    </>
  );
});

// ---------- dust motes drifting in the light ----------

/** Fixed per-mote layout, so the motes look the same every render. */
const MOTES = Array.from({ length: DUST_MAX }, (_, i) => {
  const r = (n: number) => ((Math.sin((i + 1) * 78.233 * n) * 43758.5453) % 1 + 1) % 1;
  return { x: 70 + r(1) * 170, y: 40 + r(2) * 150, dx: 10 + r(3) * 16, dy: -(12 + r(4) * 20), size: 2.2 + r(5) * 1.8 };
});

const Mote = memo(function Mote({ i, k, stage, live, reduced, color }: Live & { i: number; stage: SharedValue<number>; reduced: boolean; color: string }) {
  const m = MOTES[i];
  const t = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      cancelAnimation(t); // paused: each mote just holds where it is
      return;
    }
    // Staggered across one drift, so the motes never move in step.
    floatLoop(t, (i * AMBIENT.dustDrift.min) / DUST_MAX, AMBIENT.dustGap, AMBIENT.dustDrift);
    return () => cancelAnimation(t);
  }, [live, t, i]);
  const style = useAnimatedStyle(() => {
    const p = reduced ? 0.5 : t.get(); // Reduce Motion: motes rest mid-path, fully visible
    return {
      opacity: Math.sin(Math.PI * p) * moteOpacity(i, stage.get()) * 0.9,
      transform: [{ translateX: (m.dx * p + Math.sin(p * Math.PI * 2) * 2) * k }, { translateY: m.dy * p * k }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[box(m.x, m.y, m.size, m.size, k), { borderRadius: (m.size * k) / 2, backgroundColor: color }, style]}
    />
  );
});

export const Dust = memo(function Dust({ k, stage, live, reduced, palette }: Live & { stage: SharedValue<number>; reduced: boolean; palette: RoomPalette }) {
  return (
    <>
      {MOTES.map((_, i) => (
        <Mote key={i} i={i} k={k} stage={stage} live={live} reduced={reduced} color={palette.dust} />
      ))}
    </>
  );
});

// ---------- light: the cool morning veil and the golden glow ----------

/** Full width (edge to edge), fading out at the top and bottom so it blends into the page. */
export const Veil = memo(function Veil({ opacity, color }: { opacity: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, style]}>
      <LinearGradient colors={[clearOf(color), color, color, clearOf(color)]} locations={[0, 0.22, 0.78, 1]} style={{ flex: 1 }} />
    </Animated.View>
  );
});

export const Floor = memo(function Floor({ k, palette }: { k: number; palette: RoomPalette }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (ROOM.floorY - 40) * k, height: (ROOM.h - ROOM.floorY + 54) * k }}>
      <LinearGradient colors={[clearOf(palette.floor), palette.floor, palette.floor, clearOf(palette.floor)]} locations={[0, 0.55, 0.75, 1]} style={{ flex: 1 }} />
    </View>
  );
});
