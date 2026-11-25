import { useState } from 'react'
import { Pressable, View } from 'react-native'
import type { Venue } from '../../lib/types'
import { VENUE_TYPES } from '../../lib/labels'
import { openRoute } from '../../lib/geo'
import { colors } from '../../lib/theme'
import { DropPin, TileLayer } from './tiles'

/** Kleine Karte auf der Ortsseite (Web): Kartenkacheln mit Tropfen-Pin, Tippen öffnet die Route */
export default function MiniMap({ venue, height = 180 }: { venue: Venue; height?: number }) {
  const [width, setWidth] = useState(0)
  return (
    <Pressable onPress={() => openRoute(venue, venue.name)} accessibilityLabel={`Route zu ${venue.name}`}>
      <View style={{ height, backgroundColor: '#0f1634', overflow: 'hidden' }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <TileLayer lat={venue.latitude} lng={venue.longitude} z={15} width={width} height={height} />
        <View style={{ position: 'absolute', left: width / 2 - 17, top: height / 2 - 42 }} pointerEvents="none">
          <DropPin color={VENUE_TYPES[venue.type].color} size={34} selected />
        </View>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, backgroundColor: colors.bg, opacity: 0.25 }} pointerEvents="none" />
      </View>
    </Pressable>
  )
}
