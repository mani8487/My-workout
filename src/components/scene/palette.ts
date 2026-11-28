/**
 * Living Home room colours, tuned for the Mist light and Mist dark
 * backgrounds. The couch (Milo's art) is the same mint-sage in both modes;
 * water uses the theme's water colour.
 */
export type RoomPalette = {
  skyDay: [string, string];
  skyNight: [string, string];
  frame: string;
  sill: string;
  curtain: string;
  curtainFold: string;
  rod: string;
  ray: string;
  coolVeil: string;
  warmVeil: string;
  floor: string;
  lampShade: string;
  lampShadeLit: string;
  lampPole: string;
  lampGlow: string;
  leaf: string;
  leafDeep: string;
  pot: string;
  potRim: string;
  dust: string;
};

const light: RoomPalette = {
  skyDay: ['#BFDDEE', '#E6F2F7'],
  skyNight: ['#33435C', '#52668A'],
  frame: '#C3CDD9',
  sill: '#D3DAE3',
  curtain: '#C9D5E3',
  curtainFold: '#B7C5D6',
  rod: '#9AA7B8',
  ray: '#FFF6DE',
  coolVeil: 'rgba(64,84,120,0.16)',
  warmVeil: 'rgba(255,196,112,0.22)',
  floor: 'rgba(40,56,74,0.06)',
  lampShade: '#E6DCCB',
  lampShadeLit: '#FFE7B0',
  lampPole: '#8A94A3',
  lampGlow: '#FFD688',
  leaf: '#86BFA0',
  leafDeep: '#5F9C7E',
  pot: '#D8B49B',
  potRim: '#C79F84',
  dust: '#FFF1CC',
};

const dark: RoomPalette = {
  skyDay: ['#4C6D8B', '#6F8FA9'],
  skyNight: ['#0D1420', '#1C283B'],
  frame: '#2E3A4A',
  sill: '#344255',
  curtain: '#2F3E52',
  curtainFold: '#273546',
  rod: '#4B596C',
  ray: '#FFEFCF',
  coolVeil: 'rgba(4,8,18,0.34)',
  warmVeil: 'rgba(255,186,104,0.16)',
  floor: 'rgba(0,0,0,0.2)',
  lampShade: '#3B4658',
  lampShadeLit: '#F3D7A2',
  lampPole: '#56637A',
  lampGlow: '#FFC56C',
  leaf: '#5F9C7E',
  leafDeep: '#467A62',
  pot: '#8E705E',
  potRim: '#7A5E4E',
  dust: '#FFE6B8',
};

/**
 * The same colour fully transparent, for gradient ends (plain 'transparent' is
 * black and can muddy a fade). Only for rgba(...) colours, like the veils and floor.
 */
export function clearOf(rgba: string): string {
  return rgba.replace(/,\s*[\d.]+\)$/, ',0)');
}

export function roomPalette(isDark: boolean): RoomPalette {
  return isDark ? dark : light;
}
