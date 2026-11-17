/**
 * Text sizes and the Inter font. Hierarchy, not novelty:
 * titles largest and bold, instructions medium, sets and metadata small and muted.
 *
 * Custom fonts need a separate font file per weight, so instead of
 * "fontWeight" we pick the matching Inter file (see fontFor below).
 */
import type { TextStyle } from 'react-native';

export const INTER = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Turns a fontWeight like '600' into the right Inter font file. */
export function fontFor(weight: TextStyle['fontWeight']): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  return w >= 700 ? INTER.bold : w >= 600 ? INTER.semibold : w >= 500 ? INTER.medium : INTER.regular;
}

/** Tabular numbers: every digit is the same width, so weights and timers never jiggle. */
const tab = { fontVariant: ['tabular-nums'] } as const;

export const typography = {
  /** Screen titles. */
  title: { fontSize: 28, fontFamily: INTER.bold, letterSpacing: -0.4, ...tab },
  /** Exercise and workout names. */
  heading: { fontSize: 22, fontFamily: INTER.semibold, letterSpacing: -0.2, ...tab },
  /** Weight and reps in the set table: the biggest thing mid-workout. */
  number: { fontSize: 26, fontFamily: INTER.semibold, ...tab },
  body: { fontSize: 16, fontFamily: INTER.regular, ...tab },
  label: { fontSize: 16, fontFamily: INTER.semibold, ...tab },
  /** Previous-session numbers. */
  previous: { fontSize: 15, fontFamily: INTER.regular, ...tab },
  /** Small labels and metadata. */
  small: { fontSize: 13, fontFamily: INTER.medium, ...tab },
} satisfies Record<string, TextStyle>;

/** Larger iPhone text sizes are honoured, up to this multiple, so layouts don't break. */
export const MAX_FONT_SCALE = 1.4;

export type TextVariant = keyof typeof typography;

/** Spacing steps, so gaps look consistent everywhere. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 8 on inputs and buttons, 12 on cards. */
export const radius = {
  sm: 8,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

/** Gym rule: nothing you tap is smaller than this. */
export const MIN_TAP = 48;
