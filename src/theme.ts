import { SessionType } from './types';

export const colors = {
  bg: '#0B0F14',
  surface: '#141A22',
  surfaceAlt: '#1B232E',
  border: '#222C38',
  text: '#F2F4F7',
  textDim: '#9AA4B2',
  textFaint: '#6B7480',
  primary: '#4F8CFF',
  success: '#34D399',
  warn: '#F59E0B',
  danger: '#EF4444',
  muted: '#64748B',
};

/**
 * Zelda-inspired accent palette. Used for celebration moments
 * (milestones, big streak hits, "item get" overlays).
 *
 * - triforceGold: Triforce / item-get / legendary moments
 * - rupeeGreen/Blue/Red/Purple/Silver/Gold: rupee bursts in particle effects
 * - heartRed: heart pickup feel
 * - skyTeal: magical glow, BotW sky-island accents
 */
export const zelda = {
  triforceGold: '#FFD23F',
  triforceGoldDeep: '#B8860B',
  rupeeGreen: '#00B86B',
  rupeeBlue: '#2EA8FF',
  rupeeRed: '#E53935',
  rupeePurple: '#A459FF',
  rupeeSilver: '#C0C7D1',
  rupeeGold: '#FFC83F',
  heartRed: '#FF4D6D',
  skyTeal: '#6FDDD9',
  magicGlow: '#C6F9FF',
  parchment: '#F4E5C2',
};

/** Rupee colors cycled through particle bursts. */
export const rupeePalette = [
  zelda.rupeeGreen,
  zelda.rupeeBlue,
  zelda.triforceGold,
  zelda.rupeePurple,
  zelda.rupeeSilver,
  zelda.skyTeal,
];

export const typeColors: Record<SessionType, string> = {
  BJJ: '#FF6B3D',           // red/orange
  Lift: '#4F8CFF',           // blue
  Run: '#34D399',            // green
  'Rock Climb': '#A78BFA',   // purple
  Sauna: '#F59E0B',          // amber
  'Cold Plunge': '#22D3EE',  // cyan
  'Sauna + Cold Plunge': '#F59E0B',
  'Mobility / Recovery': '#2DD4BF', // teal
  Rest: '#64748B',           // gray
};

export const typeIcons: Record<SessionType, string> = {
  BJJ: 'flame',
  Lift: 'barbell',
  Run: 'walk',
  'Rock Climb': 'trail-sign',
  Sauna: 'sunny',
  'Cold Plunge': 'snow',
  'Sauna + Cold Plunge': 'thermometer',
  'Mobility / Recovery': 'leaf',
  Rest: 'bed',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  display: 34,
};
