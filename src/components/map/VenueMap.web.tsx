import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GERMANY, type Coords } from '../../lib/geo'
import type { Venue } from '../../lib/types'
import type { VenueMapHandle } from './VenueMap'

interface Props {
  venues: Venue[]
  selectedId: string | null
  onSelect(id: string | null): void
  showsUserLocation: boolean
}

/**
 * Web-Vorschau: OpenStreetMap-Einbettung. Die native App nutzt Apple Maps bzw. Google Maps
 * mit allen Markern; im Browser wird der gewählte Ort bzw. Deutschland gezeigt.
 */
const VenueMap = forwardRef<VenueMapHandle, Props>(function VenueMap({ venues, selectedId }, ref) {
  const [focus, setFocus] = useState<{ c: Coords; zoom: number } | null>(null)
  useImperativeHandle(ref, () => ({ focus: (c, zoom = 0.05) => setFocus({ c, zoom }) }))

  const sel = venues.find(v => v.id === selectedId)
  const src = useMemo(() => {
    const center = sel ? { c: sel as Coords, zoom: 0.02 } : focus ?? { c: GERMANY, zoom: GERMANY.latitudeDelta }
    const d = center.zoom / 2
    const bbox = [center.c.longitude - d, center.c.latitude - d, center.c.longitude + d, center.c.latitude + d].join(',')
    const marker = sel ? `&marker=${sel.latitude},${sel.longitude}` : ''
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker}`
  }, [sel, focus])

  return (
    <View style={StyleSheet.absoluteFill}>
      <iframe title="Karte" src={src} style={{ border: 0, width: '100%', height: '100%', filter: 'invert(0.9) hue-rotate(180deg) brightness(0.9)' }} />
    </View>
  )
})

export default VenueMap
