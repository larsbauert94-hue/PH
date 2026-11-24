import { View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Icon } from '../Icon'
import type { Venue } from '../../lib/types'
import { VENUE_TYPES } from '../../lib/labels'
import { colors } from '../../lib/theme'

/** Web-Vorschau: Fläche mit Ortssymbol (die App zeigt hier eine echte Karte) */
export default function MiniMap({ venue, height = 160 }: { venue: Venue; height?: number }) {
  const c = VENUE_TYPES[venue.type].color
  return (
    <LinearGradient colors={[c + '55', colors.surface]} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={venue.type === 'restaurant' ? 'restaurant' : 'wine'} size={26} color={colors.bg} />
      </View>
    </LinearGradient>
  )
}
