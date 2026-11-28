/**
 * Milo's colours (Mist & Mint art palette). Used by the placeholder art and by
 * everything the renderer draws in code (contact shadow, "z"s, confetti).
 * assets/mascot/README.md lists the same colours for the illustrator.
 */
export const MILO_ART = {
  line: '#4A5563', // soft outline, readable on light and dark backgrounds
  fur: '#A9B2BE',
  stripe: '#7F8996',
  white: '#F7F8FA',
  pink: '#E8B4B8',
  eye: '#28384A',
  mint: '#A8DCC6',
  mintLight: '#BFE6D5',
  mintDeep: '#8FCDB3',
  wood: '#B08D6E',
  aqua: '#55CBE3',
  /** The water inside Milo (one colour for every drink), its opacity, and the lighter surface line. */
  liquid: '#5CC8E0',
  liquidSurface: '#DDF5FB',
} as const;

/** How strongly the water tints his fur: enough to read the level, light enough that his markings stay clear. */
export const LIQUID_OPACITY = 0.47;

/** Code-drawn extras, tuned separately for light and dark backgrounds. */
export const MILO_FX = {
  light: { shadow: 'rgba(40,56,74,0.16)', z: '#616E80' },
  dark: { shadow: 'rgba(0,0,0,0.38)', z: '#AAB6C6' },
  confetti: [MILO_ART.mint, '#CBEBDD', MILO_ART.mintDeep],
} as const;
