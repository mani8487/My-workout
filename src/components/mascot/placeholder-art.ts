/**
 * PLACEHOLDER art for Milo, drawn from simple SVG shapes in the Mist & Mint
 * palette (grey-and-white tabby, mint collar). Each string is one layer, drawn
 * in that layer's own box (viewBox = 0 0 w h from layers.ts).
 *
 * To use real art, replace a string here with the illustrator's SVG for that
 * layer (same viewBox). See assets/mascot/README.md.
 */
import type { LayerName } from './layers';

const LINE = '#4A5563'; // soft outline, readable on light and dark backgrounds
const FUR = '#A9B2BE';
const STRIPE = '#7F8996';
const WHITE = '#F7F8FA';
const PINK = '#E8B4B8';
const EYE = '#28384A';
const MINT = '#A8DCC6';
const MINT_LIGHT = '#BFE6D5';
const MINT_DEEP = '#8FCDB3';
const WOOD = '#B08D6E';
const AQUA = '#55CBE3';

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const line = `stroke="${LINE}" stroke-width="2"`;

export const PLACEHOLDER_ART: Record<LayerName, string> = {
  couch: svg(
    212,
    104,
    `<rect x="26" y="4" width="160" height="56" rx="20" fill="${MINT}" ${line}/>
     <path d="M70 10 v40 M106 10 v40 M142 10 v40" stroke="${MINT_DEEP}" stroke-width="2"/>
     <rect x="22" y="52" width="168" height="30" rx="12" fill="${MINT_LIGHT}" ${line}/>
     <rect x="2" y="30" width="38" height="62" rx="16" fill="${MINT}" ${line}/>
     <rect x="172" y="30" width="38" height="62" rx="16" fill="${MINT}" ${line}/>
     <rect x="14" y="76" width="184" height="18" rx="8" fill="${MINT_DEEP}" ${line}/>
     <path d="M30 94 l-3 9 h8 l1 -9 Z M176 94 l1 9 h8 l-3 -9 Z" fill="${WOOD}" ${line}/>`,
  ),
  tail: svg(
    64,
    60,
    `<path d="M6 54 C30 56 50 50 54 34 C57 22 50 12 42 14" stroke="${LINE}" stroke-width="15"/>
     <path d="M6 54 C30 56 50 50 54 34 C57 22 50 12 42 14" stroke="${FUR}" stroke-width="11"/>
     <path d="M47 15 C45.5 14 44 13.6 42 14" stroke="${WHITE}" stroke-width="11"/>
     <path d="M26 50 l1 7 M40 45 l4 6 M50 33 l7 1" stroke="${STRIPE}" stroke-width="3"/>`,
  ),
  'body-lie': svg(
    140,
    56,
    `<path d="M20 52 C6 52 4 32 17 21 C32 9 72 4 102 8 C128 12 138 28 136 42 C135 50 128 54 116 54 Z" fill="${FUR}" ${line}/>
     <path d="M38 53 C56 45 92 45 114 53 Z" fill="${WHITE}"/>
     <path d="M64 7 q3 8 -1 14 M80 6 q3 8 -1 14 M96 7 q3 8 -1 14 M112 11 q3 8 -1 13" stroke="${STRIPE}" stroke-width="3"/>
     <ellipse cx="118" cy="51" rx="12" ry="5" fill="${WHITE}" ${line}/>`,
  ),
  'body-sit': svg(
    116,
    110,
    `<path d="M58 6 C34 6 22 26 20 52 C17 78 10 92 12 100 C14 106 24 108 58 108 C92 108 102 106 104 100 C106 92 99 78 96 52 C94 26 82 6 58 6 Z" fill="${FUR}" ${line}/>
     <path d="M58 10 C44 10 38 30 40 54 C42 78 48 96 58 98 C68 96 74 78 76 54 C78 30 72 10 58 10 Z" fill="${WHITE}"/>
     <path d="M24 46 q7 3 12 0 M21 62 q8 4 14 0 M19 78 q8 4 14 1 M92 46 q-7 3 -12 0 M95 62 q-8 4 -14 0 M97 78 q-8 4 -14 1" stroke="${STRIPE}" stroke-width="3"/>
     <path d="M15 98 C19 86 33 84 37 97 M101 98 C97 86 83 84 79 97" ${line}/>
     <rect x="33" y="56" width="18" height="48" rx="9" fill="${FUR}" ${line}/>
     <ellipse cx="42" cy="103" rx="11" ry="6" fill="${WHITE}" ${line}/>`,
  ),
  'front-paw': svg(
    26,
    58,
    `<rect x="4" y="4" width="18" height="46" rx="9" fill="${FUR}" ${line}/>
     <ellipse cx="13" cy="50" rx="11" ry="6" fill="${WHITE}" ${line}/>
     <path d="M10 50 v3 M16 50 v3" stroke="${STRIPE}" stroke-width="1.4"/>`,
  ),
  'ear-left': svg(
    34,
    36,
    `<path d="M4 34 L8 5 C9 1 12 1 14 3 L32 25" fill="${FUR}" ${line}/>
     <path d="M10 28 L11 10 L24 23 Z" fill="${PINK}"/>`,
  ),
  'ear-right': svg(
    34,
    36,
    `<path d="M30 34 L26 5 C25 1 22 1 20 3 L2 25" fill="${FUR}" ${line}/>
     <path d="M24 28 L23 10 L10 23 Z" fill="${PINK}"/>`,
  ),
  collar: svg(
    56,
    22,
    `<path d="M4 6 Q28 16 52 6 L52 11 Q28 21 4 11 Z" fill="${MINT}" stroke="${LINE}" stroke-width="1.6"/>
     <circle cx="28" cy="16" r="3.6" fill="${MINT_DEEP}" stroke="${LINE}" stroke-width="1.3"/>`,
  ),
  head: svg(
    108,
    82,
    `<path d="M54 6 C24 6 8 22 7 44 C6 58 12 66 18 70 C26 77 40 80 54 80 C68 80 82 77 90 70 C96 66 102 58 101 44 C100 22 84 6 54 6 Z" fill="${FUR}" ${line}/>
     <path d="M44 12 l3 12 M54 9 v13 M64 12 l-3 12 M10 42 l10 3 M11 51 h9 M98 42 l-10 3 M97 51 h-9" stroke="${STRIPE}" stroke-width="3"/>
     <path d="M54 46 C42 46 32 54 32 62 C32 72 42 77 54 77 C66 77 76 72 76 62 C76 54 66 46 54 46 Z" fill="${WHITE}"/>
     <path d="M49 55 h10 l-5 5 Z" fill="${PINK}" stroke="${LINE}" stroke-width="1.2"/>
     <path d="M54 60 v3 M54 63 c-2 3 -6 3 -7 0 M54 63 c2 3 6 3 7 0" stroke="${LINE}" stroke-width="1.6"/>
     <path d="M30 60 l-16 -3 M30 65 l-16 2 M78 60 l16 -3 M78 65 l16 2" stroke="#8A94A1" stroke-width="1.2"/>`,
  ),
  'eyes-open': svg(
    64,
    22,
    `<ellipse cx="12" cy="11" rx="7.5" ry="8.5" fill="${EYE}"/>
     <ellipse cx="52" cy="11" rx="7.5" ry="8.5" fill="${EYE}"/>
     <circle cx="14.5" cy="7.5" r="2.6" fill="#FFFFFF"/>
     <circle cx="54.5" cy="7.5" r="2.6" fill="#FFFFFF"/>`,
  ),
  'eyes-closed': svg(
    64,
    22,
    `<path d="M5 11 q7 6 14 0 M45 11 q7 6 14 0" stroke="${EYE}" stroke-width="2.6"/>`,
  ),
  bowl: svg(
    60,
    28,
    `<path d="M3 8 H57 C55 21 46 26 30 26 C14 26 5 21 3 8 Z" fill="${WHITE}" ${line}/>
     <ellipse cx="30" cy="8" rx="27" ry="5" fill="${AQUA}" ${line}/>
     <path d="M12 16 h36" stroke="${MINT}" stroke-width="3"/>`,
  ),
};
