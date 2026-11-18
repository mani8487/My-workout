/**
 * Colour roles: "Calibrated Steel and Brass".
 *
 * Every colour in the app is referred to by its JOB (its "role"), never by a
 * raw value. Dark and light are just two value sets for the same roles.
 *
 * Note on contrast: the design's darkest grey (#5F6773) is too faint for
 * small text on the dark background (fails WCAG AA), so muted TEXT uses the
 * lighter "textSecondary" grey; the darker grey is only used for decoration.
 */

export type ColorRoles = {
  background: string;
  /** Cards and panels. */
  card: string;
  /** Raised surface, e.g. the "Last time" card. */
  cardAlt: string;
  /** Hairline borders between layers (no drop shadows anywhere). */
  border: string;
  /** Number and text boxes. */
  input: string;
  inputBorder: string;

  text: string;
  /** Secondary/muted text: labels, previous results, metadata. */
  textMuted: string;
  /** Decorative only (never for text you need to read). */
  faint: string;

  /** Brushed brass: actions, highlights, PR pills. */
  accent: string;
  /** Text on top of solid brass. */
  onAccent: string;
  accentSoft: string;

  /** Titanium grey for chart lines and the timer track. */
  chart: string;

  /** Completed sets: mint tick and a deep green row tint. */
  success: string;
  successSoft: string;

  /** "Owed" badge: soft amber. */
  warning: string;
  warningSoft: string;

  /** "Done" badge: muted sage. */
  sage: string;
  sageSoft: string;

  /** Deleting, and the "0 reps left" chip (used softly). */
  danger: string;
  dangerSoft: string;

  /** Optional soft gradient behind whole screens (Frost). */
  backgroundGradient: [string, string] | null;

  /** The big "today's workout" card on Home. */
  heroStart: string;
  heroEnd: string;
  onHero: string;
  onHeroMuted: string;
  heroChip: string;
  /** The Start Workout button inside the hero card. */
  heroButton: string;
  onHeroButton: string;

  /** The weight-suggestion card on Active Workout. */
  suggestBg: string;
  onSuggest: string;
  /** Coloured left edge, or 'transparent' for none. */
  suggestEdge: string;
};

export const darkColors: ColorRoles = {
  background: '#0E0F11',
  card: '#17191D',
  cardAlt: '#1E2126',
  border: 'rgba(255,255,255,0.07)',
  input: '#22252B',
  inputBorder: '#2E323A',

  text: '#F3F4F6',
  textMuted: '#8A93A2',
  faint: '#5F6773',

  accent: '#C8A96A',
  onAccent: '#0E0F11',
  accentSoft: 'rgba(200,169,106,0.14)',

  chart: '#7C8594',

  success: '#6EE7B7',
  successSoft: 'rgba(46,111,94,0.25)',

  warning: '#E0B25C',
  warningSoft: 'rgba(224,178,92,0.14)',

  sage: '#9DBFAE',
  sageSoft: 'rgba(157,191,174,0.14)',

  danger: '#B84A4A',
  dangerSoft: 'rgba(184,74,74,0.18)',

  backgroundGradient: null,
  heroStart: '#1E2126',
  heroEnd: '#17191D',
  onHero: '#F3F4F6',
  onHeroMuted: '#8A93A2',
  heroChip: 'rgba(255,255,255,0.06)',
  heroButton: '#C8A96A',
  onHeroButton: '#0E0F11',

  suggestBg: '#17191D',
  onSuggest: '#F3F4F6',
  suggestEdge: '#C8A96A',
};

export const lightColors: ColorRoles = {
  background: '#F5F3EE',
  card: '#FFFFFF',
  cardAlt: '#EFEDE7',
  border: 'rgba(0,0,0,0.08)',
  input: '#ECEAE4',
  inputBorder: '#DAD7CF',

  text: '#17191D',
  textMuted: '#5F6773',
  faint: '#A3A8B0',

  accent: '#9A7B34',
  onAccent: '#0E0F11', // dark text on brass passes contrast; white would not
  accentSoft: 'rgba(154,123,52,0.12)',

  chart: '#7C8594',

  success: '#2E6F5E',
  successSoft: 'rgba(46,111,94,0.14)',

  warning: '#9A6A12',
  warningSoft: 'rgba(224,178,92,0.18)',

  sage: '#4F7A65',
  sageSoft: 'rgba(79,122,101,0.12)',

  danger: '#B84A4A',
  dangerSoft: 'rgba(184,74,74,0.12)',

  backgroundGradient: null,
  heroStart: '#FFFFFF',
  heroEnd: '#F8F6F1',
  onHero: '#17191D',
  onHeroMuted: '#5F6773',
  heroChip: 'rgba(0,0,0,0.05)',
  heroButton: '#9A7B34',
  onHeroButton: '#0E0F11',

  suggestBg: '#FFFFFF',
  onSuggest: '#17191D',
  suggestEdge: '#9A7B34',
};

/**
 * Frost: calm and airy. Pale cool blue-grey, frosted glass cards, dark slate
 * accents. Muted text is darkened slightly from the design's #98A2B0 so it
 * stays readable on glass (WCAG AA).
 */
export const frostColors: ColorRoles = {
  background: '#E6ECF2',
  card: 'rgba(255,255,255,0.62)',
  cardAlt: '#FFFFFF',
  border: 'rgba(255,255,255,0.75)',
  input: '#F4F7FA',
  inputBorder: '#CDD5DF',

  text: '#1F2630',
  textMuted: '#5F6B79',
  faint: '#98A2B0',

  accent: '#3E4756',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(62,71,86,0.10)',

  chart: '#8C98AA',

  success: '#3F8F7A',
  successSoft: 'rgba(63,143,122,0.16)',

  warning: '#9A6A12',
  warningSoft: 'rgba(224,178,92,0.20)',

  sage: '#3F8F7A',
  sageSoft: 'rgba(63,143,122,0.12)',

  danger: '#B84A4A',
  dangerSoft: 'rgba(184,74,74,0.12)',

  backgroundGradient: ['#E6ECF2', '#D5DDE6'],
  heroStart: '#475062',
  heroEnd: '#5E6A7E',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(255,255,255,0.78)',
  heroChip: 'rgba(255,255,255,0.14)',
  heroButton: '#FFFFFF',
  onHeroButton: '#1F2630',

  suggestBg: '#3E4756',
  onSuggest: '#FFFFFF',
  suggestEdge: 'transparent',
};
