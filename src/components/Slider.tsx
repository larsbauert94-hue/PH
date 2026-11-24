import { useEffect, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import { colors } from '../lib/theme'

/**
 * Schlanker Schieberegler (einheitlich auf iOS, Android und Web).
 * Bei Bereichen mit negativem Minimum füllt sich die Spur von der Mitte aus.
 */
export default function Slider({ min, max, value, onChange, step = 1, accessibilityLabel }: {
  min: number; max: number; value: number; onChange: (v: number) => void; step?: number; accessibilityLabel?: string
}) {
  const [width, setWidth] = useState(0)
  const grantX = useRef(0)
  const latest = useRef({ min, max, step, onChange, width })
  useEffect(() => { latest.current = { min, max, step, onChange, width } })

  const toValue = (x: number) => {
    const { min: lo, max: hi, step: s, width: w } = latest.current
    const raw = lo + Math.min(1, Math.max(0, x / (w || 1))) * (hi - lo)
    return Math.round(raw / s) * s
  }
  // eslint-disable-next-line react-hooks/refs -- Refs werden nur während der Geste gelesen
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => { grantX.current = e.nativeEvent.locationX; latest.current.onChange(toValue(grantX.current)) },
    onPanResponderMove: (_e, g) => latest.current.onChange(toValue(grantX.current + g.dx)),
  }))

  const frac = (value - min) / (max - min)
  const zero = min < 0 ? (0 - min) / (max - min) : 0
  const left = Math.min(frac, zero), right = Math.max(frac, zero)

  return (
    <View
      style={st.hit}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessible
      role="slider"
      aria-label={accessibilityLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      onAccessibilityAction={e => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? 10 : -10) * step)))}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      {...pan.panHandlers}
    >
      <View style={st.track} pointerEvents="none">
        <View style={[st.fill, { left: `${left * 100}%`, width: `${(right - left) * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[st.thumb, { left: frac * width - 11 }]} />
    </View>
  )
}

const st = StyleSheet.create({
  hit: { flex: 1, height: 36, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
})
