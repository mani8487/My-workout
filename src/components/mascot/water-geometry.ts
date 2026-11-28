/**
 * Where the water inside Milo sits, as worklets (computed on the UI thread).
 *
 * The level is one line in stage coordinates (the 240 x 240 stage), rising
 * from the bottom of the current pose's silhouette (head + body + ears, not
 * the tail) to above the ear tips. Each furry layer draws its own share of the
 * water: the stage-space shapes below are mapped into the layer's own box, so
 * the line meets up across body, head and ears. Sitting and lying have their
 * own range; between them (waking) the line blends with the pose, so the
 * level never jumps.
 *
 * Mapping: the body layers carry their water with them (it squashes and
 * breathes with the body, so nothing is redrawn while he idles). The head
 * group's placement (lying, a tilt, a lap, a glance down), each ear's turn and
 * the lifted paw are undone, so the water stays level in the world instead of
 * tilting with them. Shapes are only rebuilt when the level, the pose, one of
 * those moves, or a slosh or pour changes.
 */
import { LAYERS, LIE_POSE, NECK, type LayerName } from './layers';

/** Pose silhouettes ("body masks") as a vertical range on the stage: where 0% and 100% sit. */
export const FILL_RANGE = {
  /** Sitting (also stretching, cameos, travel): feet on the ground to the ear tips (y 26), plus room for the waves. */
  sit: { bottom: 208, top: 18 },
  /** The sleeping curl on the couch: the bottom of the curl to the lying ear tips (about y 79). */
  lie: { bottom: 168, top: 72 },
} as const;
/**
 * The line rises a touch slower at first (level^1.12), so at half the goal it sits just below the
 * chin instead of drawing a thin "bib" under the muzzle; 0 and 100% are unchanged.
 */
const LEVEL_CURVE = 1.12;

/** Where the pour stream falls (stage x) and where his head starts (the stream is drawn above it, then fades inside). */
const POUR = { lie: { x: 73, head: 102 }, sit: { x: 120, head: 44 }, top: 2, w: 4.5 } as const;

/** The resting surface shape and the slosh after a drink (stage units). */
const WAVE = { amp: 1.2, length: 64, sloshAmp: 3.6, sloshLength: 48, tilt: 3 } as const;

/** Stage x range the surface is sampled over (wider than Milo), and how many points. */
const X0 = -12;
const X1 = 252;
const SAMPLES = 24;
const DEEP = 420; // far below anything: the bottom of the water shape

/** The head group's placement on the stage (as the renderer moves it), without the breathing bob and squash. */
export type HeadPlace = { dx: number; dy: number; rot: number; scale: number };

/** Everything the mapping needs about how Milo is posed right now. */
export type WaterPose = {
  /** Pose blend, 0 lying ... 1 sitting. */
  q: number;
  /** Paw lift (0..1, the front paw turns up to -130 degrees). */
  paw: number;
  head: HeadPlace;
  /** Each ear's current turn, in degrees. */
  earL: number;
  earR: number;
};

/** How a layer's water is mapped: carried by the body, by the head group (and its ear), or the turning paw. */
export type WaterFrame = 'body' | 'head' | 'paw';

export const FRAME_OF: Partial<Record<LayerName, WaterFrame>> = {
  'body-sit': 'body',
  'body-lie': 'body',
  'front-paw': 'paw',
  head: 'head',
  'ear-left': 'head',
  'ear-right': 'head',
};

const DEG = Math.PI / 180;

/**
 * The head group's placement: lying on the couch (blended by the pose), lifting while waking, a tilt,
 * dipping to drink, a lap, a lick and a glance down. The renderer adds the body's squash and the
 * breathing bob on top. Shared by the renderer and the water, so the two always agree.
 */
export function headPlacement(q: number, lift: number, turn: number, dip: number, lap: number, lick: number, glance: number): HeadPlace {
  'worklet';
  const H = LIE_POSE.head;
  return {
    dx: H.dx * (1 - q) + turn * 0.4,
    dy:
      (H.dy - lift * 12) * (1 - q) + // lying, or lifting the head while waking
      dip * 44 + lap * 5 + // drinking
      lick * 4 + glance * 7, // water: the lap and lick, a glance down at the bowl
    rot: H.rotate * (1 - lift) * (1 - q) + turn + glance * 5,
    scale: H.scale + (1 - H.scale) * q,
  };
}

/** The water line on the stage for a fill level (0..FILL_CAP) in the current pose. Past 100% he stays full. */
export function waterLine(level: number, q: number): number {
  'worklet';
  const f = Math.pow(Math.min(1, Math.max(0, level)), LEVEL_CURVE);
  const lie = FILL_RANGE.lie.bottom - f * (FILL_RANGE.lie.bottom - FILL_RANGE.lie.top);
  const sit = FILL_RANGE.sit.bottom - f * (FILL_RANGE.sit.bottom - FILL_RANGE.sit.top);
  return lie + (sit - lie) * q;
}

/** One slosh (0 → 1 through it): a quick swell, then it dies away while its waves slow. */
function sloshAt(x: number, s: number): number {
  'worklet';
  if (s <= 0 || s >= 1) return 0;
  const env = Math.min(1, s / 0.1) * (1 - s) * (1 - s);
  const wave = WAVE.sloshAmp * env * Math.sin((2 * Math.PI * x) / WAVE.sloshLength + 6 * Math.PI * s);
  const rock = WAVE.tilt * env * Math.sin(5 * Math.PI * s) * ((x - 120) / 100);
  return wave + rock;
}

/** Height of the surface at stage x: a gentle sine at rest, plus up to two sloshes (drinks close together). */
export function surfaceAt(x: number, slosh1: number, slosh2: number): number {
  'worklet';
  return WAVE.amp * Math.sin((2 * Math.PI * x) / WAVE.length) + sloshAt(x, slosh1) + sloshAt(x, slosh2);
}

/** Undo a turn of `deg` degrees around (ox, oy). */
function unturn(x: number, y: number, ox: number, oy: number, deg: number): [number, number] {
  'worklet';
  if (deg === 0) return [x, y];
  const a = -deg * DEG;
  const vx = x - ox;
  const vy = y - oy;
  return [ox + vx * Math.cos(a) - vy * Math.sin(a), oy + vx * Math.sin(a) + vy * Math.cos(a)];
}

/** Maps a stage point into a layer's own box (see the file comment). */
function toLocal(name: LayerName, frame: WaterFrame, p: WaterPose, x: number, y: number): [number, number] {
  'worklet';
  const b = LAYERS[name];
  let px = x;
  let py = y;
  if (frame === 'head') {
    // Undo the head group: translate, turn and scale around the neck.
    const h = p.head;
    const [ux, uy] = unturn(x - h.dx, y - h.dy, NECK.x, NECK.y, h.rot);
    px = NECK.x + (ux - NECK.x) / h.scale;
    py = NECK.y + (uy - NECK.y) / h.scale;
    // Then the ear's own turn around its base.
    const ear = name === 'ear-left' ? p.earL : name === 'ear-right' ? p.earR : 0;
    if (ear !== 0) [px, py] = unturn(px, py, b.x + b.pivot.x, b.y + b.pivot.y, ear);
  } else if (frame === 'paw') {
    // The paw turns around its shoulder; undo that turn so the water stays level in a raised paw.
    [px, py] = unturn(x, y, b.x + b.pivot.x, b.y + b.pivot.y, -130 * p.paw);
  }
  return [px - b.x, py - b.y];
}

function n1(v: number): number {
  'worklet';
  return Math.round(v * 10) / 10;
}

/** A closed shape from stage points, mapped into the layer, as an SVG path. */
function polygon(name: LayerName, frame: WaterFrame, p: WaterPose, pts: readonly (readonly [number, number])[]): string {
  'worklet';
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = toLocal(name, frame, p, pts[i][0], pts[i][1]);
    d += `${i === 0 ? 'M' : 'L'}${n1(x)} ${n1(y)}`;
  }
  return `${d}Z`;
}

export const EMPTY_PATH = 'M0 0Z';

function smoothThrough(pts: [number, number][]): string {
  'worklet';
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${n1(pts[i][0])} ${n1(pts[i][1])} ${n1(mx)} ${n1(my)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${n1(last[0])} ${n1(last[1])}`;
}

/** The water body (fill) and its surface line, in the layer's own coordinates. */
export function waterPaths(name: LayerName, frame: WaterFrame, p: WaterPose, level: number, slosh1: number, slosh2: number): { body: string; surface: string } {
  'worklet';
  if (level <= 0.001) return { body: EMPTY_PATH, surface: EMPTY_PATH };
  const b = LAYERS[name];
  const line = waterLine(level, p.q);
  const top: [number, number][] = [];
  let above = true; // every surface point above the layer's box: it is simply full
  let below = true; // ...or below it: dry
  for (let i = 0; i <= SAMPLES; i++) {
    const x = X0 + ((X1 - X0) * i) / SAMPLES;
    const pt = toLocal(name, frame, p, x, line + surfaceAt(x, slosh1, slosh2));
    if (pt[1] > -2) above = false;
    if (pt[1] < b.h + 2) below = false;
    top.push(pt);
  }
  if (below) return { body: EMPTY_PATH, surface: EMPTY_PATH };
  if (above) return { body: `M-4 -4H${b.w + 4}V${b.h + 4}H-4Z`, surface: EMPTY_PATH };
  const surface = smoothThrough(top);
  const [rx, ry] = toLocal(name, frame, p, X1, line + DEEP);
  const [lx, ly] = toLocal(name, frame, p, X0, line + DEEP);
  return { body: `${surface}L${n1(rx)} ${n1(ry)}L${n1(lx)} ${n1(ly)}Z`, surface };
}

/**
 * The pour (0..1 through one pour) as a segment on the stage: it falls from above Milo toward the
 * surface, then its tail follows it in. Returns where it is: x, the top and bottom of the stream, and
 * how far down his head starts (the stream shows above that, and only faintly inside him).
 */
export function pourSegment(level: number, q: number, t: number): { x: number; tail: number; head: number; inner: number; headTop: number; w: number } {
  'worklet';
  const x = POUR.lie.x + (POUR.sit.x - POUR.lie.x) * q;
  const headTop = POUR.lie.head + (POUR.sit.head - POUR.lie.head) * q;
  if (t <= 0 || t >= 1) return { x, tail: 0, head: 0, inner: 0, headTop, w: 0 };
  const line = waterLine(level, q) + 2;
  // Outside, the stream always lands on his head (when he's nearly full, the water line is above it).
  const land = Math.max(line, headTop + 3);
  const fall = Math.min(1, t / 0.35);
  const reach = 1 - (1 - fall) * (1 - fall); // speeds up as it falls
  const tailT = Math.max(0, (t - 0.65) / 0.35);
  const tail = POUR.top + (land - POUR.top) * tailT * tailT;
  return {
    x,
    tail,
    head: POUR.top + (land - POUR.top) * reach,
    inner: POUR.top + (line - POUR.top) * reach, // inside him it goes on down to the surface
    headTop,
    w: POUR.w * (1 - 0.4 * tailT),
  };
}

/** The part of the pour inside a layer (clipped by its fur): faint, mostly behind the muzzle and chest. */
export function pourPath(name: LayerName, frame: WaterFrame, p: WaterPose, level: number, t: number): string {
  'worklet';
  const s = pourSegment(level, p.q, t);
  const top = Math.max(s.tail, s.headTop - 4);
  if (s.w <= 0 || s.inner - top < 1) return EMPTY_PATH;
  return polygon(name, frame, p, [
    [s.x - s.w / 2, top],
    [s.x + s.w / 2, top],
    [s.x + s.w / 2, s.inner],
    [s.x - s.w / 2, s.inner],
  ]);
}

/** The goal shimmer: a soft diagonal band of light sweeping across (0..1). */
export function shimmerPath(name: LayerName, frame: WaterFrame, p: WaterPose, t: number): string {
  'worklet';
  if (t <= 0 || t >= 1) return EMPTY_PATH;
  const x = -60 + 360 * t;
  return polygon(name, frame, p, [
    [x, -20],
    [x + 26, -20],
    [x - 40, 260],
    [x - 66, 260],
  ]);
}

/** Bubbles after a drink: up to 8, drifting up from low in the body to the surface. */
export const BUBBLES = [
  { x: 80, delay: 0, r: 2.2, wobble: 1.5 },
  { x: 154, delay: 0.08, r: 1.6, wobble: 2 },
  { x: 92, delay: 0.18, r: 1.4, wobble: 1.2 },
  { x: 160, delay: 0.26, r: 2, wobble: 1.6 },
  { x: 86, delay: 0.34, r: 1.2, wobble: 1 },
  { x: 148, delay: 0.42, r: 1.5, wobble: 1.4 },
  { x: 76, delay: 0.5, r: 1.8, wobble: 1.8 },
  { x: 166, delay: 0.58, r: 1.3, wobble: 1.1 },
] as const;

/** Bubble i at progress t (0..1 for the whole burst): where (in the layer) and how visible. */
export function bubbleAt(name: LayerName, frame: WaterFrame, p: WaterPose, level: number, i: number, t: number): { cx: number; cy: number; r: number; opacity: number } {
  'worklet';
  const bb = BUBBLES[i];
  const u = (t - bb.delay) / (1 - bb.delay);
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1 || level <= 0.02) return { cx: 0, cy: 0, r: 0, opacity: 0 };
  const line = waterLine(level, p.q);
  const bottom = FILL_RANGE.lie.bottom + (FILL_RANGE.sit.bottom - FILL_RANGE.lie.bottom) * p.q - 8;
  if (bottom - line < 6) return { cx: 0, cy: 0, r: 0, opacity: 0 };
  const rise = 1 - (1 - u) * (1 - u); // quick at first, slowing near the top
  const y = bottom - (bottom - line - 3) * rise;
  // Lying: bubbles gather toward the middle of the curl.
  const x = 120 + (bb.x - 120) * (0.75 + 0.25 * p.q) + bb.wobble * Math.sin(u * Math.PI * 3);
  const [cx, cy] = toLocal(name, frame, p, x, y);
  return { cx, cy, r: bb.r * (0.7 + 0.5 * u), opacity: Math.sin(Math.PI * u) * 0.85 };
}
