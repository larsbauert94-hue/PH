import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Circle, Marker, type Region } from 'react-native-maps'
import { VENUE_TYPES } from '../../lib/labels'
import { GERMANY, type Coords } from '../../lib/geo'
import type { Venue } from '../../lib/types'

export interface VenueMapHandle {
  /** zoom = Nord-Süd-Ausdehnung in Grad (latitudeDelta) */
  focus(c: Coords, zoom?: number): void
  /** +1 = näher heran, -1 = weiter weg */
  zoomBy(step: number): void
}

interface Props {
  venues: Venue[]
  selectedId: string | null
  onSelect(id: string | null): void
  showsUserLocation: boolean
  userLocation?: Coords | null
  /** Radius um den Standort, der als Kreis gezeigt wird (km) */
  radiusKm?: number
}

/** Native Karte: Apple Maps auf iOS, Google Maps auf Android */
const VenueMap = forwardRef<VenueMapHandle, Props>(function VenueMap({ venues, selectedId, onSelect, showsUserLocation, userLocation, radiusKm = 20 }, ref) {
  const map = useRef<MapView>(null)
  const region = useRef<Region>(GERMANY)
  useImperativeHandle(ref, () => ({
    focus: (c, zoom = 0.05) => map.current?.animateToRegion({ ...c, latitudeDelta: zoom, longitudeDelta: zoom / Math.cos((c.latitude * Math.PI) / 180) }, 400),
    zoomBy: step => {
      const r = region.current
      const f = step > 0 ? 0.5 : 2
      map.current?.animateToRegion({ ...r, latitudeDelta: Math.min(60, r.latitudeDelta * f), longitudeDelta: Math.min(60, r.longitudeDelta * f) }, 250)
    },
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
      onRegionChangeComplete={r => { region.current = r }}
    >
      {userLocation && (
        <Circle center={userLocation} radius={radiusKm * 1000} strokeColor="rgba(227,165,133,0.6)" fillColor="rgba(227,165,133,0.06)" strokeWidth={1.5} />
      )}
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
