import { Platform } from 'react-native'

export const colors = {
  bg: '#0e0b0c',
  surface: '#171213',
  surface2: '#221b1d',
  border: '#2e2427',
  text: '#f4ece4',
  muted: 'rgba(244,236,228,0.62)',
  faint: 'rgba(244,236,228,0.38)',
  wine: '#b23a55',
  wineLight: '#d0627a',
  amber: '#e8ad5a',
  amberLight: '#f3c98b',
  danger: '#e5484d',
  success: '#5cbf7a',
}

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 }
export const space = (n: number) => n * 4
