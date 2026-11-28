/**
 * The water fill needs Milo's furry layers in two parts: the plain fur colour
 * underneath, and everything drawn on top of it (outline, stripes, white
 * chest, paws, face, inner ears). The water goes in between, so his markings
 * stay crisp on top of it.
 *
 * The parts are cut from the existing art (placeholder-art.ts, untouched):
 * every shape filled with the fur colour is a "fur shape". It is drawn once as
 * fill only, the water goes right above it (clipped to it), and the same shape
 * as outline only follows with everything after it. Drawn without water, the
 * parts add up to the original layer exactly. Replacement art works the same
 * way as long as fur shapes use the fur colour (see assets/mascot/README.md).
 */
import type { LayerName } from './layers';
import { MILO_ART } from './palette';
import { PLACEHOLDER_ART } from './placeholder-art';
import { FRAME_OF } from './water-geometry';

export type FurShape =
  | { kind: 'path'; d: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

/** One layer, in drawing order: art, water (clipped to a fur shape), art, ... */
export type WaterPiece = { type: 'art'; xml: string } | { type: 'water'; shape: FurShape; main: boolean };

/** The layers that hold water: head, body and ears (not the tail, couch, collar, towel or bowl). */
export const WATER_LAYERS = Object.keys(FRAME_OF) as LayerName[];

const FUR_FILL = `fill="${MILO_ART.fur}"`;
const ELEMENT = /<(path|rect|ellipse|circle)\b[^>]*?\/>/g;

const attr = (el: string, name: string) => {
  const m = el.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const num = (el: string, name: string) => Number(attr(el, name) ?? 0);

function shapeOf(el: string): FurShape | null {
  if (el.startsWith('<path')) return { kind: 'path', d: attr(el, 'd') ?? '' };
  if (el.startsWith('<rect')) return { kind: 'rect', x: num(el, 'x'), y: num(el, 'y'), width: num(el, 'width'), height: num(el, 'height'), rx: num(el, 'rx') };
  if (el.startsWith('<ellipse')) return { kind: 'ellipse', cx: num(el, 'cx'), cy: num(el, 'cy'), rx: num(el, 'rx'), ry: num(el, 'ry') };
  return null;
}

function split(xml: string): WaterPiece[] {
  const open = xml.slice(0, xml.indexOf('>') + 1);
  const close = '</svg>';
  const wrap = (body: string) => `${open}${body}${close}`;
  const pieces: WaterPiece[] = [];
  let pending = '';
  let first = true;
  for (const m of xml.matchAll(ELEMENT)) {
    const el = m[0];
    const shape = el.includes(FUR_FILL) ? shapeOf(el) : null;
    if (!shape) {
      pending += el;
      continue;
    }
    if (pending) pieces.push({ type: 'art', xml: wrap(pending) });
    // The fur colour alone, then the water, then this shape's outline (followed by what comes after it).
    const fillOnly = el.replace(/\sstroke(-width)?="[^"]*"/g, '');
    pieces.push({ type: 'art', xml: wrap(fillOnly) });
    pieces.push({ type: 'water', shape, main: first });
    first = false;
    pending = el.replace(FUR_FILL, 'fill="none"');
  }
  if (pending) pieces.push({ type: 'art', xml: wrap(pending) });
  return pieces;
}

export const WATER_ART = Object.fromEntries(WATER_LAYERS.map((name) => [name, split(PLACEHOLDER_ART[name])])) as Record<LayerName, WaterPiece[]>;
