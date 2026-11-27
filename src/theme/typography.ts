/**
 * Text sizes, fonts and shapes for Mist & Mint: DM Sans, soft 20pt cards and
 * pill buttons.
 */
import type { TextStyle } from 'react-native';

const FONT = {
  light: 'DMSans_300Light',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
};
type Weight = keyof typeof FONT;

/** Turns a fontWeight like '600' into the right font file. */
export function fontFor(weight: TextStyle['fontWeight']): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  return w >= 700 ? FONT.bold : w >= 600 ? FONT.semibold : w >= 500 ? FONT.medium : w >= 400 ? FONT.regular : FONT.light;
}

/** Tabular numbers: every digit is the same width, so weights and timers never jiggle. */
const tab = { fontVariant: ['tabular-nums'] } as const;

const f = (w: Weight) => FONT[w];

export const typography = {
  /** Screen titles. */
  get title(): TextStyle { return { fontSize: 28, fontFamily: f('bold'), letterSpacing: -0.4, ...tab }; },
  /** Exercise and workout names. */
  get heading(): TextStyle { return { fontSize: 22, fontFamily: f('semibold'), letterSpacing: -0.2, ...tab }; },
  /** Weight and reps in the set table: the biggest thing mid-workout. */
  get number(): TextStyle { return { fontSize: 26, fontFamily: f('semibold'), ...tab }; },
  get body(): TextStyle { return { fontSize: 16, fontFamily: f('regular'), ...tab }; },
  get label(): TextStyle { return { fontSize: 16, fontFamily: f('semibold'), ...tab }; },
  /** Previous-session numbers. */
  get previous(): TextStyle { return { fontSize: 15, fontFamily: f('regular'), ...tab }; },
  /** Small labels and metadata. */
  get small(): TextStyle { return { fontSize: 13, fontFamily: f('medium'), ...tab }; },
  /** The big Home greeting. */
  get display(): TextStyle { return { fontSize: 34, fontFamily: f('bold'), letterSpacing: -0.6, ...tab }; },
};

export type TextVariant = keyof typeof typography;

/**
 * Larger iPhone text sizes are honoured up to this multiple (Apple expects text to
 * keep growing). Tight spots like the set table and week strip use their own lower cap.
 */
export const MAX_FONT_SCALE = 2;
/** For text inside fixed-size cells (week strip, table headers). */
export const TIGHT_FONT_SCALE = 1.3;

/** Spacing steps, so gaps look consistent everywhere. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner rounding. sm = inputs, md = buttons (pills), lg = cards. */
export const radius = {
  sm: 14,
  md: 999,
  lg: 20,
  pill: 999,
} as const;

/** Gym rule: nothing you tap is smaller than this. */
export const MIN_TAP = 48;

/** Mist & Mint, in its light or dark version. */
export type ThemeName = 'mist' | 'mist-dark';
