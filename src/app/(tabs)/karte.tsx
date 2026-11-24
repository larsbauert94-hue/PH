import { useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import VenueMap, { type VenueMapHandle } from '../../components/map/VenueMap'
import { useVenues } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { VENUE_TYPES } from '../../lib/labels'
import { distanceKm, formatDistance, openRoute, type Coords } from '../../lib/geo'
import { colors, radius } from '../../lib/theme'
import type { Venue, VenueType } from '../../lib/types'
import { Button, Chip, Empty } from '../../components/ui'
import { notify } from '../../components/report'

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const { profile } = useMe()
  const venues = useVenues()
  const map = useRef<VenueMapHandle>(null)
  const [type, setType] = useState<VenueType | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<'karte' | 'liste'>('karte')
  const [me, setMe] = useState<Coords | null>(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    const list = (venues.data ?? [])
      .filter(v => !type || v.type === type)
      .filter(v => !s || `${v.name} ${v.city} ${v.address}`.toLowerCase().includes(s))
    return me ? [...list].sort((a, b) => distanceKm(me, a) - distanceKm(me, b)) : list
  }, [venues.data, type, search, me])

  const sel = filtered.find(v => v.id === selected) ?? null

  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') { notify('Standort', 'Erlaube den Standortzugriff in den Einstellungen, um Orte in deiner Nähe zu sehen.'); return }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
    setMe(c)
    map.current?.focus(c, 0.08)
  }

  const select = (v: Venue) => {
    setSelected(v.id)
    setMode('karte')
    map.current?.focus(v, 0.02)
  }

  const canAdd = profile.account_type === 'bar' || profile.account_type === 'restaurant'

  return (
    <View style={st.root}>
      {mode === 'karte' && <VenueMap ref={map} venues={filtered} selectedId={selected} onSelect={setSelected} showsUserLocation={!!me} />}

      <View style={[st.top, { paddingTop: insets.top + 8 }, mode === 'liste' && { backgroundColor: colors.bg }]}>
        <View style={st.searchRow}>
          <View style={st.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Bar, Restaurant oder Stadt" placeholderTextColor={colors.faint} style={st.searchInput} />
          </View>
          <Pressable style={st.round} onPress={() => setMode(mode === 'karte' ? 'liste' : 'karte')} accessibilityLabel={mode === 'karte' ? 'Liste anzeigen' : 'Karte anzeigen'}>
            <Ionicons name={mode === 'karte' ? 'list' : 'map'} size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          <Chip label="Alle" active={!type} onPress={() => setType(null)} />
          {(Object.keys(VENUE_TYPES) as VenueType[]).map(t => (
            <Chip key={t} label={VENUE_TYPES[t].label} active={type === t} onPress={() => setType(type === t ? null : t)} />
          ))}
        </ScrollView>
      </View>

      {mode === 'liste' ? (
        <FlatList
          data={filtered}
          keyExtractor={v => v.id}
          contentContainerStyle={{ padding: 16, gap: 10, maxWidth: 680, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Empty icon="location-outline" text={venues.isPending ? 'Lade Orte …' : 'Keine Orte gefunden.'} />}
          renderItem={({ item }) => <VenueRow venue={item} me={me} onPress={() => router.push(`/ort/${item.id}`)} />}
        />
      ) : (
        <>
          <View style={[st.fabs, { bottom: sel ? 190 : filtered.length ? 104 : 24 }]}>
            {canAdd && (
              <Pressable style={st.round} onPress={() => router.push('/ort/neu')} accessibilityLabel="Betrieb eintragen">
                <Ionicons name="add" size={24} color={colors.text} />
              </Pressable>
            )}
            <Pressable style={st.round} onPress={locate} accessibilityLabel="Mein Standort">
              <Ionicons name="locate" size={22} color={colors.accent} />
            </Pressable>
          </View>
          {sel && (
            <View style={st.sheet}>
              <VenueRow venue={sel} me={me} onPress={() => router.push(`/ort/${sel.id}`)} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Route" icon="navigate" variant="secondary" style={{ flex: 1 }} onPress={() => openRoute(sel, sel.name)} />
                <Button title="Details" style={{ flex: 1 }} onPress={() => router.push(`/ort/${sel.id}`)} />
              </View>
            </View>
          )}
          {!sel && filtered.length > 0 && (
            <ScrollView horizontal style={st.strip} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} showsHorizontalScrollIndicator={false}>
              {filtered.slice(0, 20).map(v => (
                <Pressable key={v.id} style={st.mini} onPress={() => select(v)}>
                  <View style={[st.dot, { backgroundColor: VENUE_TYPES[v.type].color }]} />
                  <Text style={st.miniName} numberOfLines={1}>{v.name}</Text>
                  <Text style={st.miniMeta} numberOfLines={1}>{v.city}{me ? ` · ${formatDistance(distanceKm(me, v))}` : ''}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}

function VenueRow({ venue, me, onPress }: { venue: Venue; me: Coords | null; onPress: () => void }) {
  const t = VENUE_TYPES[venue.type]
  return (
    <Pressable onPress={onPress} style={st.row}>
      <View style={[st.rowIcon, { backgroundColor: t.color + '22' }]}>
        <Ionicons name={venue.type === 'restaurant' ? 'restaurant' : 'wine'} size={20} color={t.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowName}>{venue.name}</Text>
        <Text style={st.rowMeta} numberOfLines={1}>{t.label} · {venue.address}, {venue.city}</Text>
      </View>
      {me && <Text style={st.rowDist}>{formatDistance(distanceKm(me, venue))}</Text>}
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  )
}

const shadow = { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { gap: 10, paddingBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: colors.border, ...shadow },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, ...shadow },
  fabs: { position: 'absolute', right: 16, gap: 10 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border, ...shadow },
  strip: { position: 'absolute', left: 0, right: 0, bottom: 16, flexGrow: 0 },
  mini: { width: 160, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 4, borderWidth: 1, borderColor: colors.border, ...shadow },
  dot: { width: 8, height: 8, borderRadius: 4 },
  miniName: { color: colors.text, fontWeight: '600' },
  miniMeta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  rowDist: { color: colors.accentLight, fontSize: 13 },
})
