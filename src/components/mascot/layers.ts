/**
 * Milo's "paper puppet" layers: where each piece sits and which point it
 * turns around (its pivot).
 *
 * Everything is measured on one 240 x 240 stage. x / y are the top-left
 * corner of the layer on that stage; w / h its size; pivot is measured from
 * the layer's own top-left corner. The renderer scales the stage to any size.
 *
 * assets/mascot/README.md repeats this table for the illustrator. If you
 * change a number here, change it there too.
 */
export const STAGE = 240;

export type LayerName =
  | 'couch'
  | 'tail'
  | 'body-lie'
  | 'body-sit'
  | 'front-paw'
  | 'ear-left'
  | 'ear-right'
  | 'towel'
  | 'collar'
  | 'head'
  | 'eyes-open'
  | 'eyes-closed'
  | 'bowl';

export type LayerBox = { x: number; y: number; w: number; h: number; pivot: { x: number; y: number } };

export const LAYERS: Record<LayerName, LayerBox> = {
  couch: { x: 14, y: 112, w: 212, h: 104, pivot: { x: 106, y: 104 } },
  tail: { x: 160, y: 150, w: 64, h: 60, pivot: { x: 6, y: 54 } },
  'body-lie': { x: 50, y: 112, w: 140, h: 56, pivot: { x: 70, y: 54 } },
  'body-sit': { x: 62, y: 100, w: 116, h: 110, pivot: { x: 58, y: 108 } },
  'front-paw': { x: 124, y: 150, w: 26, h: 58, pivot: { x: 13, y: 8 } },
  'ear-left': { x: 72, y: 22, w: 34, h: 36, pivot: { x: 17, y: 32 } },
  'ear-right': { x: 134, y: 22, w: 34, h: 36, pivot: { x: 17, y: 32 } },
  towel: { x: 82, y: 104, w: 76, h: 44, pivot: { x: 38, y: 10 } },
  collar: { x: 92, y: 110, w: 56, h: 22, pivot: { x: 28, y: 8 } },
  head: { x: 66, y: 38, w: 108, h: 82, pivot: { x: 54, y: 74 } },
  'eyes-open': { x: 88, y: 66, w: 64, h: 22, pivot: { x: 32, y: 11 } },
  'eyes-closed': { x: 88, y: 66, w: 64, h: 22, pivot: { x: 32, y: 11 } },
  bowl: { x: 90, y: 164, w: 60, h: 28, pivot: { x: 30, y: 28 } },
};

/** Stage points the groups turn around. */
export const NECK = { x: 120, y: 112 }; // head group (head, ears, eyes, collar)
export const TAIL_BASE = { x: 166, y: 204 };
export const GROUND_Y = 208;

/**
 * Lying pose (on the couch) as offsets from the sitting pose. The renderer
 * blends between the two, which is how "waking" crossfades into "sitting".
 */
export const LIE_POSE = {
  head: { dx: -34, dy: 50, rotate: -12, scale: 0.9 },
  tail: { dx: 18, dy: -54, rotate: 70 },
};
