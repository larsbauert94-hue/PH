import { useId } from 'react'
import { Text, View, type TextStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { colors, fonts } from '../lib/theme'

/** Das „P“ mit Tropfen als Innenraum (viewBox 0 0 100 100). Gleiche Form wie in assets/icon.png. */
export const LOGO_PATH =
  'M30.5 16 H54.5 A22 22 0 0 1 54.5 60 H44.5 V84 H30.5 Z M56.5 24.5 C56.5 24.5 48 34.5 48 41 A8.5 8.5 0 0 0 65 41 C65 34.5 56.5 24.5 56.5 24.5 Z'

/** App-Icon: Roségold-P auf Nachtblau. `bare` zeigt nur das Zeichen ohne Hintergrund. */
export function LogoMark({ size = 64, bare = false }: { size?: number; bare?: boolean }) {
  // Eigene ID je Logo: im Browser greift ein Verlauf sonst nicht, wenn sein erstes Vorkommen verdeckt ist
  const id = `pourRose${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Pour Logo">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.roseLight} />
          <Stop offset="1" stopColor={colors.roseDeep} />
        </LinearGradient>
      </Defs>
      {!bare && <Rect width="100" height="100" rx="22" fill={colors.brandNavy} />}
      <Path d={LOGO_PATH} fill={`url(#${id})`} fillRule="evenodd" />
    </Svg>
  )
}

/** Schriftzug „POUR“ in Bodoni Moda */
export function Wordmark({ size = 40, style }: { size?: number; style?: TextStyle }) {
  return (
    <Text style={[{ fontFamily: fonts.brand, fontSize: size, letterSpacing: size * 0.12, color: colors.accentLight, lineHeight: size * 1.15 }, style]}>
      POUR
    </Text>
  )
}

/** Zeichen und Schriftzug nebeneinander, z. B. im Feed-Kopf */
export function LogoLockup({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.35 }}>
      <LogoMark size={size} />
      <Wordmark size={size * 0.72} />
    </View>
  )
}
