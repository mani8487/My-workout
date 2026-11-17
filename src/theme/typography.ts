/**
 * Text sizes. Hierarchy, not novelty:
 * titles largest and bold, instructions medium, sets and metadata small and muted.
 * (We'll switch the font itself to Inter in the polish step.)
 */
import type { TextStyle } from 'react-native';

export const typography = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 16, fontWeight: '600' },
  small: { fontSize: 13, fontWeight: '400' },
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
