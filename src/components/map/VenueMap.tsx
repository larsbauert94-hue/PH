import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { VENUE_TYPES } from '../../lib/labels'
import { GERMANY, type Coords } from '../../lib/geo'
import type { Venue } from '../../lib/types'

export interface VenueMapHandle { focus(c: Coords, zoom?: number): void }

interface Props {
  venues: Venue[]
  selectedId: string | null
  onSelect(id: string | null): void
  showsUserLocation: boolean
}

/** Native Karte: Apple Maps auf iOS, Google Maps auf Android */
const VenueMap = forwardRef<VenueMapHandle, Props>(function VenueMap({ venues, selectedId, onSelect, showsUserLocation }, ref) {
  const map = useRef<MapView>(null)
  useImperativeHandle(ref, () => ({
    focus: (c, zoom = 0.05) => map.current?.animateToRegion({ ...c, latitudeDelta: zoom, longitudeDelta: zoom }, 400),
  }))

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={GERMANY}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      userInterfaceStyle="dark"
      onPress={e => { if (e.nativeEvent.action !== 'marker-press') onSelect(null) }}
    >
      {venues.map(v => (
        <Marker
          key={v.id}
          coordinate={{ latitude: v.latitude, longitude: v.longitude }}
          pinColor={VENUE_TYPES[v.type].color}
          opacity={selectedId && selectedId !== v.id ? 0.6 : 1}
          onPress={() => onSelect(v.id)}
          tracksViewChanges={false}
        />
      ))}
    </MapView>
  )
})

export default VenueMap
