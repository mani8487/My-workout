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
  geist: {
    light: 'Geist_300Light',
    regular: 'Geist_400Regular',
    medium: 'Geist_500Medium',
    semibold: 'Geist_600SemiBold',
    bold: 'Geist_700Bold',
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
/** Ember only: a serif for titles and a mono for numbers (null = use the body font). */
let serif: string | null = null;
let mono: string | null = null;
/** Ember's italic serif, for the quieter half of two-tone titles (e.g. the weekday). */
export const SERIF_ITALIC = 'InstrumentSerif_400Regular_Italic';

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
  get title(): TextStyle { if (serif) return { fontSize: 32, fontFamily: serif, ...tab }; return { fontSize: 28, fontFamily: f('bold'), letterSpacing: -0.4, ...tab }; },
  /** Exercise and workout names. */
  get heading(): TextStyle { if (serif) return { fontSize: 25, fontFamily: serif, ...tab }; return { fontSize: 22, fontFamily: f('semibold'), letterSpacing: -0.2, ...tab }; },
  /** Weight and reps in the set table: the biggest thing mid-workout. */
  get number(): TextStyle { if (mono) return { fontSize: 20, fontFamily: mono, ...tab }; return { fontSize: 26, fontFamily: f('semibold'), ...tab }; },
  get body(): TextStyle { return { fontSize: 16, fontFamily: f('regular'), ...tab }; },
  get label(): TextStyle { return { fontSize: 16, fontFamily: f('semibold'), ...tab }; },
  /** Previous-session numbers. */
  get previous(): TextStyle { return { fontSize: 15, fontFamily: f('regular'), ...tab }; },
  /** Small labels and metadata. */
  get small(): TextStyle { return { fontSize: 13, fontFamily: f('medium'), ...tab }; },
  /** The big Home greeting. */
  get display(): TextStyle { if (serif) return { fontSize: 28, fontFamily: serif, ...tab }; return { fontSize: 34, fontFamily: f('bold'), letterSpacing: -0.6, ...tab }; },
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

/** Corner rounding. sm = inputs, md = buttons, lg = cards. Changed per theme. */
export const radius = {
  sm: 8,
  md: 8,
  lg: 12,
  pill: 999,
};

/** Gym rule: nothing you tap is smaller than this. */
export const MIN_TAP = 48;

export type ThemeName = 'dark' | 'light' | 'frost' | 'ember' | 'mist' | 'mist-dark';

/** Mist & Mint, in either its light or dark version. */
export const isMistTheme = (name: ThemeName) => name === 'mist' || name === 'mist-dark';

/** Called by the theme provider whenever the theme changes. */
export function applyThemeStyle(name: ThemeName) {
  const frost = name === 'frost';
  const ember = name === 'ember';
  const mist = isMistTheme(name);
  family = frost ? FONTS.manrope : ember ? FONTS.geist : FONTS.inter;
  serif = ember ? 'InstrumentSerif_400Regular' : null;
  mono = ember ? 'GeistMono_500Medium' : null;
  radius.sm = ember ? MIN_TAP / 2 : frost || mist ? 14 : 8; // Ember kg / reps boxes are pills
  radius.md = frost || ember || mist ? 999 : 8; // Frost and Ember buttons are full pills
  radius.lg = ember ? 22 : frost ? 24 : mist ? 20 : 12;
}
