/**
 * Colour roles for Mist & Mint, the app's one look.
 *
 * Every colour in the app is referred to by its JOB (its "role"), never by a
 * raw value. Light and dark are two value sets for the same roles; the app
 * follows the iPhone's setting unless Settings picks one.
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

  /** Main actions and highlights (navy in light, mint in dark). */
  accent: string;
  /** Text on top of the accent colour. */
  onAccent: string;
  accentSoft: string;

  /** Titanium grey for chart lines and the timer track. */
  chart: string;
  /** Water tracking: the droplet gauge and hydration bars (aqua). */
  water: string;

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

  /** The soft gradient behind whole screens. */
  backgroundGradient: [string, string];

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

/**
 * Mist & Mint (light): soft blue-grey mist, white cards, navy text and
 * buttons, mint for achievements (always with navy text on it), aqua for water.
 */
export const mistColors: ColorRoles = {
  background: '#EDF0F4',
  card: '#FFFFFF',
  cardAlt: '#F4F6F9',
  border: 'rgba(40,56,74,0.08)',
  input: '#F4F6F9',
  inputBorder: '#D5DCE5',

  text: '#28384A',
  textMuted: '#616E80',
  faint: '#AAB3BF',

  accent: '#28384A',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(40,56,74,0.07)',

  chart: '#8C98AA',
  water: '#36B6D5',

  success: '#A8DCC6',
  successSoft: 'rgba(168,220,198,0.32)',

  warning: '#9A6A12',
  warningSoft: 'rgba(224,178,92,0.18)',

  sage: '#A8DCC6',
  sageSoft: 'rgba(168,220,198,0.32)',

  danger: '#B84A4A',
  dangerSoft: 'rgba(184,74,74,0.12)',

  // A whisper of mint toward the bottom, so the glass tiles have something to show through.
  backgroundGradient: ['#EDF0F4', '#E0EBE8'],
  heroStart: '#FFFFFF',
  heroEnd: '#FFFFFF',
  onHero: '#28384A',
  onHeroMuted: '#616E80',
  heroChip: 'rgba(40,56,74,0.06)',
  heroButton: '#28384A',
  onHeroButton: '#FFFFFF',

  suggestBg: '#FFFFFF',
  onSuggest: '#28384A',
  suggestEdge: '#A8DCC6',
};

/** Mist & Mint (dark): deep navy, slate cards, mint buttons with navy text. */
export const mistDarkColors: ColorRoles = {
  background: '#151C26',
  card: '#222D3B',
  cardAlt: '#2B3848',
  border: 'rgba(241,244,248,0.07)',
  input: '#2B3848',
  inputBorder: '#3A4859',

  text: '#F1F4F8',
  textMuted: '#AAB6C6',
  faint: '#4A5869',

  accent: '#A8DCC6',
  onAccent: '#28384A',
  accentSoft: 'rgba(168,220,198,0.14)',

  chart: '#7D8A9C',
  water: '#55CBE3',

  success: '#A8DCC6',
  successSoft: 'rgba(168,220,198,0.16)',

  warning: '#E8B860',
  warningSoft: 'rgba(232,184,96,0.16)',

  sage: '#A8DCC6',
  sageSoft: 'rgba(168,220,198,0.14)',

  danger: '#E07070',
  dangerSoft: 'rgba(224,112,112,0.16)',

  backgroundGradient: ['#151C26', '#16242A'],
  heroStart: '#222D3B',
  heroEnd: '#222D3B',
  onHero: '#F1F4F8',
  onHeroMuted: '#AAB6C6',
  heroChip: 'rgba(241,244,248,0.08)',
  heroButton: '#A8DCC6',
  onHeroButton: '#28384A',

  suggestBg: '#222D3B',
  onSuggest: '#F1F4F8',
  suggestEdge: '#A8DCC6',
};
