/**
 * Colour roles.
 *
 * Every colour in the app is referred to by its JOB (its "role"), never by a raw value.
 * Switching between light and dark mode just means swapping which set below is used.
 *
 * Rules from the design: one accent colour for actions, green for success,
 * a calm background, and no extra decorative colours. Amber is only used
 * for the small "Owed" badge, and red only for deleting.
 */

export type ColorRoles = {
  /** The screen behind everything. Calm and quiet. */
  background: string;
  /** Cards and panels that sit on the background. */
  card: string;
  /** A slightly different card shade, e.g. input fields or a set row. */
  cardAlt: string;
  /** Thin lines between things. */
  border: string;

  /** Main text: titles and numbers you need to read mid-workout. */
  text: string;
  /** Muted text: metadata, "previous" results, hints. */
  textMuted: string;

  /** The one action colour: buttons, highlights, the progress bar. */
  accent: string;
  /** Text or icons sitting on top of the accent colour. */
  onAccent: string;
  /** A faint wash of the accent, e.g. the suggested workout card. */
  accentSoft: string;

  /** Success: ticked sets, "Done", personal records. */
  success: string;
  successSoft: string;

  /** Only for the "Owed" badge. */
  warning: string;
  warningSoft: string;

  /** Only for delete actions. */
  danger: string;
};

export const lightColors: ColorRoles = {
  background: '#F4F5F7',
  card: '#FFFFFF',
  cardAlt: '#EDEFF2',
  border: '#E1E4E8',

  text: '#0F1115',
  textMuted: '#6B7280',

  accent: '#2563EB',
  onAccent: '#FFFFFF',
  accentSoft: '#E3ECFD',

  success: '#16A34A',
  successSoft: '#DFF5E6',

  warning: '#B45309',
  warningSoft: '#FCEFD8',

  danger: '#DC2626',
};

export const darkColors: ColorRoles = {
  background: '#0B0D10',
  card: '#171A1F',
  cardAlt: '#22262D',
  border: '#2B3038',

  text: '#F3F4F6',
  textMuted: '#9CA3AF',

  accent: '#3B82F6',
  onAccent: '#FFFFFF',
  accentSoft: '#1A2A47',

  success: '#22C55E',
  successSoft: '#13301F',

  warning: '#F59E0B',
  warningSoft: '#3A2B10',

  danger: '#EF4444',
};
