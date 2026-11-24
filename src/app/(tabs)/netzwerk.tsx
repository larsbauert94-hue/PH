import { useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useProfiles } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { ACCOUNT_TYPES, subtitle } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { AccountType } from '../../lib/types'
import { Avatar, Chip, Empty, ErrorView, Loading, Verified } from '../../components/ui'

const FILTERS: { label: string; types?: AccountType[] }[] = [
  { label: 'Alle' },
  { label: 'Marken', types: ['marke'] },
  { label: 'Händler', types: ['haendler'] },
  { label: 'Lieferanten', types: ['lieferant'] },
  { label: 'Bars', types: ['bar'] },
  { label: 'Restaurants', types: ['restaurant'] },
  { label: 'Gastro-Profis', types: ['gastro'] },
  { label: 'Genießer:innen', types: ['privat'] },
]

export default function Network() {
  const { me } = useMe()
  const [filter, setFilter] = useState(0)
  const [search, setSearch] = useState('')
  const profiles = useProfiles(FILTERS[filter].types, search.trim() || undefined)
  const list = (profiles.data ?? []).filter(p => p.id !== me)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={st.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Name, Stadt, Position …" placeholderTextColor={colors.faint} style={st.input} autoCapitalize="none" />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
          {FILTERS.map((f, i) => <Chip key={f.label} label={f.label} active={filter === i} onPress={() => setFilter(i)} />)}
        </ScrollView>
      </View>
      {profiles.isPending ? <Loading /> : profiles.isError ? <ErrorView error={profiles.error} onRetry={profiles.refetch} /> : (
        <FlatList
          data={list}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, maxWidth: 680, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Empty icon="people-outline" text="Niemand gefunden." />}
          renderItem={({ item: p }) => (
            <Pressable style={st.row} onPress={() => router.push(`/profil/${p.id}`)}>
              <Avatar name={p.name} url={p.avatar_url} type={p.account_type} size={48} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={st.name} numberOfLines={1}>{p.name}</Text>
                  {p.verified && <Verified />}
                </View>
                <Text style={st.meta} numberOfLines={1}>{subtitle(p)}</Text>
                {!ACCOUNT_TYPES[p.account_type].business && p.city ? <Text style={st.city}>{p.city}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  city: { color: colors.faint, fontSize: 12, marginTop: 2 },
})
