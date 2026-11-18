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

const VARIANT_WEIGHT: Record<string, Weight> = {
  title: 'bold',
  heading: 'semibold',
  number: 'semibold',
  body: 'regular',
  label: 'semibold',
  previous: 'regular',
  small: 'medium',
};

export const typography = {
  /** Screen titles. */
  title: { fontSize: 28, fontFamily: family.bold, letterSpacing: -0.4, ...tab },
  /** Exercise and workout names. */
  heading: { fontSize: 22, fontFamily: family.semibold, letterSpacing: -0.2, ...tab },
  /** Weight and reps in the set table: the biggest thing mid-workout. */
  number: { fontSize: 26, fontFamily: family.semibold, ...tab },
  body: { fontSize: 16, fontFamily: family.regular, ...tab },
  label: { fontSize: 16, fontFamily: family.semibold, ...tab },
  /** Previous-session numbers. */
  previous: { fontSize: 15, fontFamily: family.regular, ...tab },
  /** Small labels and metadata. */
  small: { fontSize: 13, fontFamily: family.medium, ...tab },
} satisfies Record<string, TextStyle>;

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
  for (const [variant, weight] of Object.entries(VARIANT_WEIGHT)) {
    (typography as unknown as Record<string, { fontFamily: string }>)[variant].fontFamily = family[weight];
  }
  radius.sm = frost ? 14 : 8;
  radius.md = frost ? 999 : 8; // Frost buttons are full pills
  radius.lg = frost ? 24 : 12;
}
