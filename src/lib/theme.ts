import { Platform } from 'react-native'

// Markenfarben „Mitternacht & Roségold“ (siehe Logo Pour B)
export const colors = {
  bg: '#0b1029',
  surface: '#121a3a',
  surface2: '#1a2349',
  border: '#263060',
  text: '#f3ede6',
  muted: 'rgba(243,237,230,0.66)',
  faint: 'rgba(243,237,230,0.42)',

  /** Logo-Hintergrund */
  brandNavy: '#141c40',
  /** Roségold: Hauptakzent für Buttons, aktive Tabs, Icons */
  accent: '#e3a585',
  accentLight: '#eeb999',
  roseLight: '#f8d6bd',
  roseDeep: '#c4785a',
  /** Text auf Roségold-Flächen */
  onAccent: '#0b1029',
  /** Herz/Likes und Jobs */
  heart: '#f07d8c',
  /** Lavendel als zweiter Akzent (Events, Infos) */
  lavender: '#8f99e6',

  danger: '#f06a6f',
  success: '#6cc596',
}

export const fonts = {
  /** Schriftzug „POUR“ */
  brand: 'BodoniModa_700Bold',
  /** Überschriften */
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 }
export const space = (n: number) => n * 4
