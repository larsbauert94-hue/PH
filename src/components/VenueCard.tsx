import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { isOpenNow, VENUE_TYPES } from '../lib/labels'
import { openRoute } from '../lib/geo'
import { colors, fonts, radius } from '../lib/theme'
import type { Venue } from '../lib/types'
import { Icon } from './Icon'

/** Visitenkarte eines Betriebs: geöffnet/geschlossen, Zeiten, Happy Hour, Reservieren, Route */
export function VenueCard({ venue, compact = false }: { venue: Venue; compact?: boolean }) {
  const open = isOpenNow(venue.opens, venue.closes)
  return (
    <View style={st.card}>
      {!compact && (
        <Pressable onPress={() => router.push(`/ort/${venue.id}`)} style={{ gap: 2 }}>
          <Text style={st.kicker}>{VENUE_TYPES[venue.type].label.toUpperCase()}</Text>
          <Text style={st.name}>{venue.name}</Text>
          <Text style={st.addr}>{venue.address}, {venue.city}</Text>
        </Pressable>
      )}
      {open != null && (
        <View style={st.row}>
          <View style={[st.dot, { backgroundColor: open ? '#6cc596' : colors.danger }]} />
          <Text style={[st.status, { color: open ? '#6cc596' : colors.danger }]}>{open ? 'Jetzt geöffnet' : 'Geschlossen'}</Text>
          <Text style={st.hours}>{venue.opens}–{venue.closes} Uhr</Text>
        </View>
      )}
      {!!venue.happy_hour && (
        <View style={st.row}><Icon name="time-outline" size={15} color={colors.accent} /><Text style={st.hh}>{venue.happy_hour}</Text></View>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(venue.reservation_url || venue.phone) && (
          <Pressable style={[st.btn, st.primary]} accessibilityRole="button" onPress={() => Linking.openURL(venue.reservation_url ?? `tel:${venue.phone}`)}>
            <Icon name="calendar-outline" size={16} color={colors.onAccent} />
            <Text style={st.primaryText}>Reservieren</Text>
          </Pressable>
        )}
        <Pressable style={st.btn} accessibilityRole="button" onPress={() => openRoute(venue, venue.name)}>
          <Icon name="navigate-outline" size={16} color={colors.text} />
          <Text style={st.btnText}>Route</Text>
        </Pressable>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(227,165,133,0.3)' },
  kicker: { color: colors.accentLight, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  name: { color: colors.text, fontFamily: fonts.brand, fontSize: 20 },
  addr: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontWeight: '700', fontSize: 13 },
  hours: { color: colors.muted, fontSize: 13 },
  hh: { color: colors.text, fontSize: 13, flex: 1 },
  btn: { flex: 1, height: 40, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface2 },
  primary: { backgroundColor: colors.accent },
  btnText: { color: colors.text, fontWeight: '600' },
  primaryText: { color: colors.onAccent, fontWeight: '700' },
})
