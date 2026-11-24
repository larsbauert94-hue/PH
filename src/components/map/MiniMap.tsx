import { StyleSheet, View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import type { Venue } from '../../lib/types'
import { VENUE_TYPES } from '../../lib/labels'

/** Kleine, nicht scrollbare Karte mit Markierung (Ortsseite) */
export default function MiniMap({ venue, height = 160 }: { venue: Venue; height?: number }) {
  return (
    <View style={{ height, overflow: 'hidden' }} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: venue.latitude, longitude: venue.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        scrollEnabled={false}
        zoomEnabled={false}
        liteMode
        userInterfaceStyle="dark"
      >
        <Marker coordinate={{ latitude: venue.latitude, longitude: venue.longitude }} pinColor={VENUE_TYPES[venue.type].color} />
      </MapView>
    </View>
  )
}
