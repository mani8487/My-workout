/**
 * Where the water inside Milo sits, as worklets (computed on the UI thread
 * every frame while it moves).
 *
 * The level is one line in stage coordinates (the 240 x 240 stage), rising
 * from the bottom of the current pose's silhouette (head + body + ears, not
 * the tail) to above the ear tips. Each furry layer draws its own share of the
 * water: the stage-space shapes below are mapped into the layer's own box, so
 * the line meets up across body, head and ears. Sitting and lying have their
 * own range; between them (waking) the line blends with the pose, so the
 * level never jumps.
 *
 * Mapping: body layers carry their water with them (it squashes and breathes
 * with the body). The head group's lying placement (and the lifted paw) is
 * undone, so at rest the water stays level in the world instead of tilting.
 */
import { LAYERS, LIE_POSE, NECK, type LayerName } from './layers';

/** Pose silhouettes ("body masks") as a vertical range on the stage: where 0% and 100% sit. */
export const FILL_RANGE = {
  /** Sitting (also stretching, cameos, travel): feet on the ground to the ear tips (y 26), plus room for the waves. */
  sit: { bottom: 208, top: 18 },
  /** The sleeping curl on the couch: the bottom of the curl to the lying ear tips (about y 79). */
  lie: { bottom: 168, top: 72 },
} as const;

/** Where the pour stream falls (stage x): into the top of his head, then out of sight behind the muzzle and chest. */
const POUR_X = { lie: 73, sit: 120 } as const;
const POUR_W = 4.5;

/** The gentle resting wave, and the slosh after a drink (stage units). */
const WAVE = { amp: 1.2, length: 64, sloshAmp: 3.6, sloshLength: 48, tilt: 3 } as const;

/** Stage x range the surface is sampled over (wider than Milo), and how many points. */
const X0 = -12;
const X1 = 252;
const SAMPLES = 24;
const DEEP = 420; // far below anything: the bottom of the water shape

export type WaterPose = {
  /** Pose blend, 0 lying ... 1 sitting. */
  q: number;
  /** Head lift while waking (0..1). */
  lift: number;
  /** Paw lift (0..1, the front paw turns up to -130 degrees). */
  paw: number;
};

/** How a layer's water is mapped: carried by the body, by the head group, or the turning paw. */
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

/** The water line on the stage for a fill level (0..FILL_CAP) in the current pose. */
export function waterLine(level: number, q: number): number {
  'worklet';
  const f = Math.min(1, Math.max(0, level));
  const lie = FILL_RANGE.lie.bottom - f * (FILL_RANGE.lie.bottom - FILL_RANGE.lie.top);
  const sit = FILL_RANGE.sit.bottom - f * (FILL_RANGE.sit.bottom - FILL_RANGE.sit.top);
  return lie + (sit - lie) * q;
}

/** Where the silhouette starts at the top in this pose (the pour stream starts above it). */
function topOf(q: number): number {
  'worklet';
  return FILL_RANGE.lie.top + (FILL_RANGE.sit.top - FILL_RANGE.lie.top) * q;
}

/** Height of the surface at stage x: a slow wave that shifts with each breath, plus the decaying slosh. */
export function surfaceAt(x: number, breath: number, slosh: number): number {
  'worklet';
  const rest = WAVE.amp * Math.sin((2 * Math.PI * x) / WAVE.length + Math.PI * breath);
  if (slosh <= 0 || slosh >= 1) return rest;
  // `slosh` runs 0 → 1 through one slosh: a quick swell, then it dies away while its waves slow.
  const env = Math.min(1, slosh / 0.1) * (1 - slosh) * (1 - slosh);
  const wave = WAVE.sloshAmp * env * Math.sin((2 * Math.PI * x) / WAVE.sloshLength + 6 * Math.PI * slosh);
  const rock = WAVE.tilt * env * Math.sin(5 * Math.PI * slosh) * ((x - 120) / 100);
  return rest + wave + rock;
}

/** Maps a stage point into a layer's own box (see the file comment). */
function toLocal(name: LayerName, frame: WaterFrame, p: WaterPose, x: number, y: number): [number, number] {
  'worklet';
  const b = LAYERS[name];
  let px = x;
  let py = y;
  if (frame === 'head') {
    // Undo the head group's lying placement (same numbers as the renderer's head style, at rest).
    const H = LIE_POSE.head;
    const dx = H.dx * (1 - p.q);
    const dy = (H.dy - p.lift * 12) * (1 - p.q);
    const rot = -(H.rotate * (1 - p.lift) * (1 - p.q)) * DEG;
    const s = H.scale + (1 - H.scale) * p.q;
    const vx = x - NECK.x - dx;
    const vy = y - NECK.y - dy;
    px = NECK.x + (vx * Math.cos(rot) - vy * Math.sin(rot)) / s;
    py = NECK.y + (vx * Math.sin(rot) + vy * Math.cos(rot)) / s;
  } else if (frame === 'paw' && p.paw !== 0) {
    // The paw turns around its shoulder; undo that turn so the water stays level in a raised paw.
    const ox = b.x + b.pivot.x;
    const oy = b.y + b.pivot.y;
    const a = 130 * p.paw * DEG;
    const vx = x - ox;
    const vy = y - oy;
    px = ox + vx * Math.cos(a) - vy * Math.sin(a);
    py = oy + vx * Math.sin(a) + vy * Math.cos(a);
  }
  return [px - b.x, py - b.y];
}

const n1 = (v: number) => Math.round(v * 10) / 10;

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

/** The surface's top edge as smooth curves through the sampled points (mapped into the layer). */
function surfacePoints(name: LayerName, frame: WaterFrame, p: WaterPose, line: number, breath: number, slosh: number): [number, number][] {
  'worklet';
  const out: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = X0 + ((X1 - X0) * i) / SAMPLES;
    out.push(toLocal(name, frame, p, x, line + surfaceAt(x, breath, slosh)));
  }
  return out;
}

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
export function waterPaths(name: LayerName, frame: WaterFrame, p: WaterPose, level: number, breath: number, slosh: number): { body: string; surface: string } {
  'worklet';
  if (level <= 0.001) return { body: EMPTY_PATH, surface: EMPTY_PATH };
  const line = waterLine(level, p.q);
  const top = surfacePoints(name, frame, p, line, breath, slosh);
  const surface = smoothThrough(top);
  const [rx, ry] = toLocal(name, frame, p, X1, line + DEEP);
  const [lx, ly] = toLocal(name, frame, p, X0, line + DEEP);
  return { body: `${surface}L${n1(rx)} ${n1(ry)}L${n1(lx)} ${n1(ly)}Z`, surface };
}

/**
 * The pour stream (0..1 through one pour): it falls from above Milo to the surface, then its
 * tail follows it in. Clipped by each layer's fur, so it only shows inside him.
 */
export function pourPath(name: LayerName, frame: WaterFrame, p: WaterPose, level: number, t: number): string {
  'worklet';
  if (t <= 0 || t >= 1) return EMPTY_PATH;
  const line = waterLine(level, p.q) + 2;
  const top = topOf(p.q) - 30;
  const fall = Math.min(1, t / 0.35);
  const head = top + (line - top) * (1 - (1 - fall) * (1 - fall)); // speeds up as it falls
  const tailT = Math.max(0, (t - 0.65) / 0.35);
  const tail = top + (line - top) * tailT * tailT;
  if (head - tail < 1) return EMPTY_PATH;
  const x = POUR_X.lie + (POUR_X.sit - POUR_X.lie) * p.q;
  const w = POUR_W * (1 - 0.4 * tailT); // thins out as it ends
  return polygon(name, frame, p, [
    [x - w / 2, tail],
    [x + w / 2, tail],
    [x + w / 2, head],
    [x - w / 2, head],
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
