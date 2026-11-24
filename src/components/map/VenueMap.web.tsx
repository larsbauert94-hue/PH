import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { VENUE_TYPES } from '../../lib/labels'
import { colors } from '../../lib/theme'
import type { Coords } from '../../lib/geo'
import type { Venue } from '../../lib/types'
import type { VenueMapHandle } from './VenueMap'

interface Props {
  venues: Venue[]
  selectedId: string | null
  onSelect(id: string | null): void
  showsUserLocation: boolean
}

// Ausschnitt Deutschland (grob) für die Umrechnung Längen-/Breitengrad → Bildschirm
const BOUNDS = { north: 55.1, south: 47.2, west: 5.7, east: 15.2 }
const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'Hamburg', lat: 53.55, lng: 9.99 }, { name: 'Berlin', lat: 52.52, lng: 13.4 },
  { name: 'Köln', lat: 50.94, lng: 6.96 }, { name: 'Düsseldorf', lat: 51.23, lng: 6.78 },
  { name: 'Frankfurt', lat: 50.11, lng: 8.68 }, { name: 'Leipzig', lat: 51.34, lng: 12.37 },
  { name: 'Stuttgart', lat: 48.78, lng: 9.18 }, { name: 'München', lat: 48.14, lng: 11.58 },
]

/**
 * Web-Version der Karte: eine eigene, gezeichnete Übersicht (Einbetten fremder Kartendienste ist
 * im Browser-Vorschaumodus nicht erlaubt). Die iPhone-/Android-App zeigt Apple bzw. Google Maps.
 */
const VenueMap = forwardRef<VenueMapHandle, Props>(function VenueMap({ venues, selectedId, onSelect }, ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ ...BOUNDS })
  useImperativeHandle(ref, () => ({
    focus: (c: Coords, zoom = 0.05) => {
      const span = Math.max(0.6, zoom * 12)
      setView({ north: c.latitude + span, south: c.latitude - span, west: c.longitude - span * 1.4, east: c.longitude + span * 1.4 })
    },
  }))

  const project = useMemo(() => (lat: number, lng: number) => ({
    x: ((lng - view.west) / (view.east - view.west)) * size.w,
    y: ((view.north - lat) / (view.north - view.south)) * size.h,
  }), [view, size])

  const zoomed = view.north - view.south < 6
  return (
    <View style={[StyleSheet.absoluteFill, st.ground]} onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* feines Raster wie Längen-/Breitengrade */}
      {Array.from({ length: 9 }, (_, i) => <View key={`h${i}`} style={[st.gridH, { top: `${(i + 1) * 10}%` }]} />)}
      {Array.from({ length: 6 }, (_, i) => <View key={`v${i}`} style={[st.gridV, { left: `${(i + 1) * 14}%` }]} />)}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { onSelect(null); setView({ ...BOUNDS }) }} accessibilityLabel="Ganz Deutschland zeigen" />
      {size.w > 0 && CITIES.map(c => {
        const p = project(c.lat, c.lng)
        return <Text key={c.name} style={[st.city, { left: p.x + 12, top: p.y - 8 }]} pointerEvents="none">{c.name}</Text>
      })}
      {size.w > 0 && venues.map(v => {
        const p = project(v.latitude, v.longitude)
        const sel = v.id === selectedId
        const s = sel ? 22 : zoomed ? 16 : 12
        return (
          <Pressable
            key={v.id}
            onPress={() => onSelect(v.id)}
            hitSlop={10}
            accessibilityLabel={`${v.name}, ${v.city}`}
            style={[st.pin, { left: p.x - s / 2, top: p.y - s / 2, width: s, height: s, borderRadius: s / 2, backgroundColor: VENUE_TYPES[v.type].color }, sel && st.pinSel]}
          />
        )
      })}
      {size.w > 0 && zoomed && venues.map(v => {
        const p = project(v.latitude, v.longitude)
        return <Text key={'l' + v.id} style={[st.label, { left: p.x + 12, top: p.y + 4 }]} numberOfLines={1} pointerEvents="none">{v.name}</Text>
      })}
    </View>
  )
})

export default VenueMap

const st = StyleSheet.create({
  ground: { backgroundColor: '#0f1634', overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(143,153,230,0.14)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(143,153,230,0.14)' },
  city: { position: 'absolute', color: 'rgba(243,237,230,0.45)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  label: { position: 'absolute', color: colors.text, fontSize: 11, maxWidth: 140 },
  pin: { position: 'absolute', borderWidth: 2, borderColor: colors.bg },
  pinSel: { borderColor: colors.text, borderWidth: 3 },
})
