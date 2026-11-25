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
  water: '#55CBE3',

  success: '#6EE7B7',
  successSoft: 'rgba(46,111,94,0.25)',

  warning: '#E0B25C',
  warningSoft: 'rgba(224,178,92,0.14)',

  sage: '#9DBFAE',
  sageSoft: 'rgba(157,191,174,0.14)',

  // Lighter red than Light/Frost so red text stays readable on near-black (AA).
  danger: '#D25C5C',
  dangerSoft: 'rgba(210,92,92,0.18)',

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

  // Deeper brass so brass text on white passes contrast (the old #9A7B34 didn't),
  // which in turn means white text on brass now passes too.
  accent: '#7F6428',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(127,100,40,0.12)',

  chart: '#7C8594',
  water: '#36B6D5',

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
  heroButton: '#7F6428',
  onHeroButton: '#FFFFFF',

  suggestBg: '#FFFFFF',
  onSuggest: '#17191D',
  suggestEdge: '#7F6428',
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
  water: '#36B6D5',

  // Darker green than the design's #3F8F7A so green text passes AA on the pale background.
  success: '#2F7464',
  successSoft: 'rgba(63,143,122,0.16)',

  warning: '#9A6A12',
  warningSoft: 'rgba(224,178,92,0.20)',

  sage: '#2F7464',
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

/**
 * Ember: Apple-style true black with one bright orange for actions, iOS green
 * for finished sets. Orange is used sparingly (play button, current set, Next)
 * so it always means "do this". Text on orange is black: white would fail contrast.
 */
export const emberColors: ColorRoles = {
  background: '#000000',
  card: '#1C1C1E',
  cardAlt: '#2C2C2E',
  border: 'rgba(255,255,255,0.08)',
  input: '#1C1C1E',
  inputBorder: '#2C2C2E',

  text: '#F5F5F7',
  textMuted: '#98989F',
  faint: '#48484A',

  accent: '#FF7A1A',
  onAccent: '#000000',
  accentSoft: 'rgba(255,122,26,0.16)',

  chart: '#8E8E93',
  water: '#55CBE3',

  success: '#30D158',
  successSoft: 'rgba(48,209,88,0.16)',

  warning: '#FFB340',
  warningSoft: 'rgba(255,179,64,0.16)',

  sage: '#30D158',
  sageSoft: 'rgba(48,209,88,0.14)',

  danger: '#FF453A',
  dangerSoft: 'rgba(255,69,58,0.18)',

  backgroundGradient: null,
  heroStart: '#1C1C1E',
  heroEnd: '#1C1C1E',
  onHero: '#F5F5F7',
  onHeroMuted: '#98989F',
  heroChip: '#2C2C2E',
  heroButton: '#FF7A1A',
  onHeroButton: '#000000',

  suggestBg: '#1C1C1E',
  onSuggest: '#F5F5F7',
  suggestEdge: '#FF7A1A',
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
