# Milo: layer art spec

Milo is a "paper puppet": separate transparent layers that the app moves in code.
The current art is a placeholder drawn from simple shapes. Replacement art
drops in if it follows this sheet exactly.

## The stage

- Everything sits on one **240 × 240** square stage. The app scales the stage
  to any size, so deliver **vector SVG** (preferred) or **PNG at 3× (720 × 720 stage)**.
- **x, y** = top-left corner of the layer on the stage.
- **w × h** = the layer's own canvas (SVG `viewBox="0 0 w h"`). Leave the canvas
  transparent outside the drawing. Keep everything inside the box.
- **Pivot** = the point the layer turns or scales around, measured from the
  layer's own top-left corner.
- Ground line (where feet and the shadow sit): **y = 208**. The contact
  shadow is drawn in code; don't paint one.

## Layers (sitting pose unless noted)

Listed back to front.

| Layer | x | y | w × h | Pivot (in layer) | Moves by |
|---|---|---|---|---|---|
| `couch` | 14 | 112 | 212 × 104 | 106, 104 (bottom centre) | fades out when Milo wakes |
| `tail` | 160 | 150 | 64 × 60 | 6, 54 (tail base) | sways; turns 70° to drape over the couch arm when lying |
| `body-lie` | 50 | 112 | 140 × 56 | 70, 54 (bottom centre) | lying on the couch seat: breathing, stretch |
| `body-sit` | 62 | 100 | 116 × 110 | 58, 108 (bottom centre) | breathing, squash and stretch; includes the LEFT front leg |
| `front-paw` | 124 | 150 | 26 × 58 | 13, 8 (shoulder) | Milo's RIGHT front leg; rotates up to −130° for the paw lift |
| `ear-left` | 72 | 22 | 34 × 36 | 17, 32 (ear base) | twitch ±14° |
| `ear-right` | 134 | 22 | 34 × 36 | 17, 32 (ear base) | twitch ±14° |
| `towel` | 82 | 104 | 76 × 44 | 38, 104 (the body's pivot, below the layer) | white towel over the shoulders with aqua stripes; shown after a workout (fades in), squashes and breathes with the body |
| `collar` | 92 | 110 | 56 × 22 | 28, 8 | mint collar with tag; moves with the head |
| `head` | 66 | 38 | 108 × 82 | 54, 74 (neck) | turns, lifts, dips to drink |
| `eyes-open` | 88 | 66 | 64 × 22 | 32, 11 | blink crossfade |
| `eyes-closed` | 88 | 66 | 64 × 22 | 32, 11 | sleeping, drinking, happy jump |
| `bowl` | 90 | 164 | 60 × 28 | 30, 28 | water bowl, only while drinking (in front of Milo) |

**Groups** (the app moves these together):

- **Head group**: `ear-left`, `ear-right`, `collar`, `head`, `eyes-open`,
  `eyes-closed`. Turns around the **neck at stage point (120, 112)**.
- **Tail**: turns around the **tail base at stage point (166, 204)**.
- Lying pose = head group moved by (−34, +50), turned −12°, scaled 0.9; tail
  moved by (+18, −54), turned +70°. Draw `head` and `tail` once, in the sitting
  position; the app places them for lying.

Floating "Zz", confetti and paw sparkles are drawn in code. The whole puppet
(body, towel, head group, tail) also scales from its feet at the ground line
when Milo leaps toward you or hops back in; no extra art is needed for that.

## Palette (Mist & Mint)

| Use | Colour |
|---|---|
| Fur (grey tabby) | `#A9B2BE`, stripes `#7F8996` |
| White chest, muzzle, paws | `#F7F8FA` |
| Soft outline | `#4A5563` |
| Eyes | `#28384A` |
| Collar, couch | mint `#A8DCC6` (lighter `#BFE6D5`, deeper `#8FCDB3`) |
| Water | aqua `#55CBE3` |

The art must read on both the light background `#EDF0F4` and the dark
background `#151C26`.

## Swapping the art in

1. Name each file exactly as the layer (`head.svg`, `front-paw.svg`, …).
2. For SVG: paste each file's content into its entry in
   `src/components/mascot/placeholder-art.ts` (same names). Nothing else changes.
3. Later, a Rive file can replace the whole puppet: write a `RiveRenderer`
   that follows `MiloRenderer` in `src/components/mascot/types.ts` and point
   `src/components/mascot/renderer.ts` at it. Screens don't change.
