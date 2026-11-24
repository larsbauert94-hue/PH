import { forwardRef, useImperativeHandle, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { VENUE_TYPES } from '../../lib/labels'
import { colors } from '../../lib/theme'
import { GERMANY, type Coords } from '../../lib/geo'
import type { Venue } from '../../lib/types'
import type { VenueMapHandle } from './VenueMap'

interface Props {
  venues: Venue[]
  selectedId: string | null
  onSelect(id: string | null): void
  showsUserLocation: boolean
  userLocation?: Coords | null
  /** Radius um den Standort, der als Kreis gezeigt wird (km) */
  radiusKm?: number
}

const TILE = 256
const MIN_Z = 4
const MAX_Z = 18
const clampZ = (z: number) => Math.max(MIN_Z, Math.min(MAX_Z, z))

/** Web-Mercator: Breite/Länge → Weltpixel bei Zoom z */
function toWorld(lat: number, lng: number, z: number) {
  const s = TILE * 2 ** z
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }
}
function toLatLng(x: number, y: number, z: number) {
  const s = TILE * 2 ** z
  const n = Math.PI - (2 * Math.PI * y) / s
  return { latitude: (180 / Math.PI) * Math.atan(Math.sinh(n)), longitude: (x / s) * 360 - 180 }
}
/** Zoomstufe, bei der `spanDeg` Längengrade in `width` Pixel passen */
const zoomForSpan = (spanDeg: number, width: number) => clampZ(Math.log2((360 * Math.max(width, 200)) / (TILE * spanDeg)))

/**
 * Web-Karte: dunkle Kartenkacheln (CARTO/OpenStreetMap) zum Verschieben und Zoomen
 * (Ziehen, zwei Finger, Plus/Minus). Ohne Kachelzugriff bleibt ein Raster sichtbar.
 */
const VenueMap = forwardRef<VenueMapHandle, Props>(function VenueMap({ venues, selectedId, onSelect, userLocation, radiusKm = 20 }, ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ lat: GERMANY.latitude, lng: GERMANY.longitude, z: 6 })
  const [fitted, setFitted] = useState(false)

  // Beim ersten Messen Deutschland einpassen
  if (size.w && !fitted) {
    setFitted(true)
    setView(v => ({ ...v, z: zoomForSpan(GERMANY.longitudeDelta * 1.15, size.w) }))
  }

  useImperativeHandle(ref, () => ({
    // span = Nord-Süd-Ausdehnung in Grad (wie latitudeDelta)
    focus: (c: Coords, span = 0.05) => setView({ lat: c.latitude, lng: c.longitude, z: zoomForSpan(span / Math.cos((c.latitude * Math.PI) / 180), size.w || 390) }),
    zoomBy: (d: number) => setView(v => ({ ...v, z: clampZ(v.z + d) })),
  }))

  const center = toWorld(view.lat, view.lng, view.z)
  const project = (lat: number, lng: number) => {
    const p = toWorld(lat, lng, view.z)
    return { x: p.x - center.x + size.w / 2, y: p.y - center.y + size.h / 2 }
  }

  // Ziehen verschiebt, zwei Finger zoomen
  const [pan] = useState(() => {
    let start = { x: 0, y: 0, z: 6, dist: 0 }
    const dist = (t: readonly { pageX: number; pageY: number }[]) => t.length > 1 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: e => {
        setView(v => {
          const w = toWorld(v.lat, v.lng, v.z)
          start = { x: w.x, y: w.y, z: v.z, dist: dist(e.nativeEvent.touches) }
          return v
        })
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches
        if (touches.length > 1) {
          const d = dist(touches)
          if (!start.dist) { start.dist = d; return }
          const z = clampZ(start.z + Math.log2(d / start.dist))
          const ll = toLatLng(start.x, start.y, start.z)
          setView({ lat: ll.latitude, lng: ll.longitude, z })
          return
        }
        const ll = toLatLng(start.x - g.dx, start.y - g.dy, start.z)
        setView(v => ({ ...v, lat: Math.max(-80, Math.min(80, ll.latitude)), lng: ll.longitude }))
      },
    })
  })

  // Sichtbare Kacheln
  const tz = Math.floor(view.z)
  const scale = 2 ** (view.z - tz)
  const ts = TILE * scale
  const tc = toWorld(view.lat, view.lng, tz)
  const x0 = Math.floor((tc.x - size.w / 2 / scale) / TILE)
  const x1 = Math.floor((tc.x + size.w / 2 / scale) / TILE)
  const y0 = Math.floor((tc.y - size.h / 2 / scale) / TILE)
  const y1 = Math.floor((tc.y + size.h / 2 / scale) / TILE)
  const n = 2 ** tz
  const tiles: { key: string; url: string; left: number; top: number }[] = []
  if (size.w) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue
      const wx = ((x % n) + n) % n
      tiles.push({
        key: `${tz}/${x}/${y}`,
        url: `https://${'abcd'[(x + y) & 3]}.basemaps.cartocdn.com/dark_all/${tz}/${wx}/${y}@2x.png`,
        left: (x * TILE - tc.x) * scale + size.w / 2,
        top: (y * TILE - tc.y) * scale + size.h / 2,
      })
    }
  }

  const mPerPx = (156543.03 * Math.cos((view.lat * Math.PI) / 180)) / 2 ** view.z
  const me = userLocation ? project(userLocation.latitude, userLocation.longitude) : null
  const ring = (radiusKm * 1000) / mPerPx
  const close = view.z >= 11

  return (
    <View style={[StyleSheet.absoluteFill, st.ground]} onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers}>
      {Array.from({ length: 9 }, (_, i) => <View key={`h${i}`} style={[st.gridH, { top: `${(i + 1) * 10}%` }]} />)}
      {Array.from({ length: 6 }, (_, i) => <View key={`v${i}`} style={[st.gridV, { left: `${(i + 1) * 14}%` }]} />)}
      {tiles.map(t => (
        <Image key={t.key} source={{ uri: t.url }} style={{ position: 'absolute', left: t.left, top: t.top, width: ts + 0.5, height: ts + 0.5 }} transition={0} cachePolicy="memory-disk" pointerEvents="none" />
      ))}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelect(null)} accessibilityLabel="Auswahl aufheben" />

      {me && (
        <>
          <View pointerEvents="none" style={[st.ring, { left: me.x - ring, top: me.y - ring, width: ring * 2, height: ring * 2, borderRadius: ring }]} />
          <View pointerEvents="none" style={[st.me, { left: me.x - 8, top: me.y - 8 }]} />
        </>
      )}

      {size.w > 0 && venues.map(v => {
        const p = project(v.latitude, v.longitude)
        if (p.x < -40 || p.y < -40 || p.x > size.w + 40 || p.y > size.h + 40) return null
        const sel = v.id === selectedId
        const s = sel ? 24 : close ? 18 : 13
        return (
          <View key={v.id} style={{ position: 'absolute', left: p.x - s / 2, top: p.y - s / 2 }}>
            <Pressable
              onPress={() => onSelect(v.id)}
              hitSlop={10}
              accessibilityLabel={`${v.name}, ${v.city}`}
              style={[st.pin, { width: s, height: s, borderRadius: s / 2, backgroundColor: VENUE_TYPES[v.type].color }, sel && st.pinSel]}
            />
            {(close || sel) && <Text style={st.label} numberOfLines={1} pointerEvents="none">{v.name}</Text>}
          </View>
        )
      })}
      <Text style={st.attr} pointerEvents="none">© OpenStreetMap · © CARTO</Text>
    </View>
  )
})

export default VenueMap

const st = StyleSheet.create({
  ground: { backgroundColor: '#0f1634', overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(143,153,230,0.14)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(143,153,230,0.14)' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(227,165,133,0.55)', backgroundColor: 'rgba(227,165,133,0.06)' },
  me: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#4f8cff', borderWidth: 3, borderColor: '#fff' },
  label: { position: 'absolute', left: 22, top: -2, color: colors.text, fontSize: 11, fontWeight: '600', maxWidth: 150, textShadowColor: '#000', textShadowRadius: 4 },
  pin: { borderWidth: 2, borderColor: colors.bg },
  pinSel: { borderColor: colors.text, borderWidth: 3 },
  attr: { position: 'absolute', left: 8, bottom: 4, color: 'rgba(255,255,255,0.45)', fontSize: 9 },
})
