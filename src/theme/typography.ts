/**
 * Text sizes, fonts and shapes.
 *
 * Fonts and corner shapes depend on the theme: Dark and Light use Inter with
 * 12pt cards; Frost uses Manrope with very rounded 24pt cards and pill buttons.
 * The theme provider calls applyThemeStyle() when the theme changes, and every
 * screen re-draws, so screens never need to know which theme is on.
 */
import type { TextStyle } from 'react-native';

const FONTS = {
  inter: {
    light: 'Inter_300Light',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  manrope: {
    light: 'Manrope_300Light',
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
  },
};
type Weight = keyof typeof FONTS.inter;

let family = FONTS.inter;

/** Turns a fontWeight like '600' into the right font file for the current theme. */
export function fontFor(weight: TextStyle['fontWeight']): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  return w >= 700 ? family.bold : w >= 600 ? family.semibold : w >= 500 ? family.medium : w >= 400 ? family.regular : family.light;
}

/** Tabular numbers: every digit is the same width, so weights and timers never jiggle. */
const tab = { fontVariant: ['tabular-nums'] } as const;

const f = (w: Weight) => family[w];

/**
 * Each style is built fresh when read (a "getter"), so it always uses the
 * current theme's font. (Styles handed to the screen get locked by React
 * Native, so they must never be changed afterwards.)
 */
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

/** Larger iPhone text sizes are honoured, up to this multiple, so layouts don't break. */
export const MAX_FONT_SCALE = 1.4;

/** Spacing steps, so gaps look consistent everywhere. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner rounding. sm = inputs, md = buttons, lg = cards. Changed per theme. */
export const radius = {
  sm: 8,
  md: 8,
  lg: 12,
  pill: 999,
};

/** Gym rule: nothing you tap is smaller than this. */
export const MIN_TAP = 48;

export type ThemeName = 'dark' | 'light' | 'frost';

/** Called by the theme provider whenever the theme changes. */
export function applyThemeStyle(name: ThemeName) {
  const frost = name === 'frost';
  family = frost ? FONTS.manrope : FONTS.inter;
  radius.sm = frost ? 14 : 8;
  radius.md = frost ? 999 : 8; // Frost buttons are full pills
  radius.lg = frost ? 24 : 12;
}
