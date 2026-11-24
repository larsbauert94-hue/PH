import { useEffect, useId, useState } from 'react'
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { colors } from '../lib/theme'
import { LOGO_PATH } from './Logo'

/** Tropfen im Bauch des „P“ (gleiche Form wie in LOGO_PATH) */
const DROP = 'M56.5 24.5 C56.5 24.5 48 34.5 48 41 A8.5 8.5 0 0 0 65 41 C65 34.5 56.5 24.5 56.5 24.5 Z'
const DROP_TOP = 24.5
const DROP_BOTTOM = 49.5

/** Sekunden seit dem Einblenden, aktualisiert pro Bild (für Wellen, Blasen, Übergänge) */
export function useClock(running = true) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now()
    let id = requestAnimationFrame(function frame() {
      setT((Date.now() - start) / 1000)
      id = requestAnimationFrame(frame)
    })
    return () => cancelAnimationFrame(id)
  }, [running])
  return t
}

function wave(level: number, t: number, amp: number) {
  const y = DROP_BOTTOM - level * (DROP_BOTTOM - DROP_TOP + 1)
  let d = `M44 ${y.toFixed(2)}`
  for (let x = 44; x <= 69; x += 1) {
    const dy = Math.sin(x * 0.55 + t * 3.2) * amp + Math.sin(x * 0.23 - t * 2.1) * amp * 0.6
    d += ` L${x} ${(y + dy).toFixed(2)}`
  }
  return { d: d + ' L69 52 L44 52 Z', y }
}

/**
 * Das Pour-Zeichen, dessen Tropfen sich mit Roségold füllt (oder nur der Tropfen als Ladesymbol).
 * level: 0 (leer) … 1 (voll), t: Zeit in Sekunden für die Wellenbewegung.
 */
export default function PourDrop({ size = 120, level = 0.5, t = 0, bare = false, dropOnly = false, shine }: {
  size?: number; level?: number; t?: number; bare?: boolean
  /** Nur der Tropfen (Ladesymbol), size = Höhe */ dropOnly?: boolean
  /** Lichtschimmer über dem „P“: Position 0 … 1 (außerhalb = unsichtbar) */ shine?: number
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const amp = level > 0.02 && level < 0.98 ? 0.9 : 0.25
  const liquid = wave(Math.max(0, Math.min(1, level)), t, amp)
  const bubbles = level > 0.15 ? [0, 1, 2].map(i => {
    const phase = (t * 0.55 + i * 0.37) % 1
    return { x: 53.5 + i * 3 + Math.sin(t * 2 + i) * 0.6, y: DROP_BOTTOM - 2 - phase * (DROP_BOTTOM - liquid.y - 2), r: 0.55 + i * 0.15, o: 1 - phase }
  }) : []

  return (
    <Svg width={dropOnly ? size * 23 / 30 : size} height={size} viewBox={dropOnly ? '45 22 23 30' : '0 0 100 100'} accessibilityLabel="Pour Logo">
      <Defs>
        <LinearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.roseLight} />
          <Stop offset="1" stopColor={colors.roseDeep} />
        </LinearGradient>
        <LinearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.roseLight} />
          <Stop offset="0.5" stopColor={colors.accentLight} />
          <Stop offset="1" stopColor={colors.roseDeep} />
        </LinearGradient>
        <ClipPath id={`c${id}`}><Path d={DROP} /></ClipPath>
        <ClipPath id={`p${id}`}><Path d={LOGO_PATH} fillRule="evenodd" clipRule="evenodd" /></ClipPath>
        <LinearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0.75} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {!bare && !dropOnly && <Rect width="100" height="100" rx="22" fill={colors.brandNavy} />}
      {!dropOnly && <Path d={LOGO_PATH} fill={`url(#r${id})`} fillRule="evenodd" />}
      {shine != null && shine > 0 && shine < 1 && !dropOnly && (
        // schräges Lichtband, das über das Roségold gleitet
        <G clipPath={`url(#p${id})`}>
          <Path d={`M${shine * 110 - 30} 0 h14 l-30 100 h-14 z`} fill={`url(#s${id})`} opacity={0.55} />
        </G>
      )}
      {level > 0 && (
        <G clipPath={`url(#c${id})`}>
          <Path d={liquid.d} fill={`url(#w${id})`} />
          <Path d={liquid.d.split(' L69 52')[0]} stroke="#fff1e6" strokeWidth={0.6} strokeOpacity={0.7} fill="none" />
          {bubbles.map((b, i) => <Circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#fff" opacity={0.55 * b.o} />)}
        </G>
      )}
      {dropOnly && <Path d={DROP} fill="none" stroke={`url(#r${id})`} strokeWidth={0.9} strokeLinejoin="round" />}
    </Svg>
  )
}
