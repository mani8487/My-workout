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
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Turns a fontWeight like '600' into the right Inter font file. */
export function fontFor(weight: TextStyle['fontWeight']): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  return w >= 700 ? INTER.bold : w >= 600 ? INTER.semibold : INTER.regular;
}

export const typography = {
  title: { fontSize: 28, fontFamily: INTER.bold, letterSpacing: -0.4 },
  heading: { fontSize: 20, fontFamily: INTER.semibold, letterSpacing: -0.2 },
  body: { fontSize: 16, fontFamily: INTER.regular },
  label: { fontSize: 16, fontFamily: INTER.semibold },
  small: { fontSize: 13, fontFamily: INTER.regular },
} satisfies Record<string, TextStyle>;

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

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
