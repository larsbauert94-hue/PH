import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useFeed, useProfiles } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { ACCOUNT_TYPES, subtitle } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { AccountType, Profile } from '../../lib/types'
import { Avatar, Chip, Empty, Loading, Verified } from '../../components/ui'
import { PostGrid } from '../../components/media'

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
const TRENDS = ['#gin', '#negroni', '#riesling', '#naturwein', '#cocktails', '#neuheit', '#jobs']

/** Lädt beim Scrollen nahe am Ende nach */
const nearEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
  const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
  return layoutMeasurement.height + contentOffset.y > contentSize.height - 400
}

export default function Explore() {
  const params = useLocalSearchParams<{ q?: string; tab?: string }>()
  const [query, setQuery] = useState(params.q ?? '')
  const [mode, setMode] = useState<'fuerdich' | 'personen'>(params.tab === 'personen' ? 'personen' : 'fuerdich')
  // Neue Parameter (z. B. Hashtag angetippt) übernehmen, ohne zusätzlichen Effekt
  const [seen, setSeen] = useState({ q: params.q, tab: params.tab })
  if (seen.q !== params.q || seen.tab !== params.tab) {
    setSeen({ q: params.q, tab: params.tab })
    if (params.q) setQuery(params.q)
    if (params.tab === 'personen') setMode('personen')
  }
  const q = query.trim()

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={st.searchWrap}>
        <View style={st.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Suchen: Leute, Betriebe, #hashtags" placeholderTextColor={colors.faint} style={st.input} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Suche löschen"><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
        {!q && (
          <View style={st.segment}>
            {([['fuerdich', 'Für dich'], ['personen', 'Personen & Betriebe']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setMode(k)} style={[st.segItem, mode === k && st.segActive]}>
                <Text style={[st.segText, mode === k && { color: colors.onAccent }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {q ? <SearchResults q={q} /> : mode === 'fuerdich' ? <ForYou onTag={setQuery} /> : <People />}
    </View>
  )
}

function ForYou({ onTag }: { onTag: (t: string) => void }) {
  const feed = useFeed({ withMedia: true })
  return (
    <ScrollView
      onScroll={e => { if (nearEnd(e)) feed.loadMore() }}
      scrollEventThrottle={200}
      refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { feed.refetch() }} tintColor={colors.accent} />}
      contentContainerStyle={{ maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 24 }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {TRENDS.map(t => <Chip key={t} label={t} onPress={() => onTag(t)} />)}
      </ScrollView>
      {feed.isPending ? <Loading /> : feed.posts.length ? <PostGrid posts={feed.posts} /> : <Empty icon="images-outline" text="Noch keine Fotos oder Reels." />}
    </ScrollView>
  )
}

function SearchResults({ q }: { q: string }) {
  const isTag = q.startsWith('#')
  const people = useProfiles(undefined, isTag ? undefined : q)
  const posts = useFeed({ search: q })
  const { me } = useMe()
  const persons = isTag ? [] : (people.data ?? []).filter(p => p.id !== me).slice(0, 12)
  return (
    <ScrollView onScroll={e => { if (nearEnd(e)) posts.loadMore() }} scrollEventThrottle={200} contentContainerStyle={{ maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
      {persons.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={st.section}>Personen & Betriebe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
            {persons.map(p => <PersonCard key={p.id} p={p} />)}
          </ScrollView>
        </View>
      )}
      <Text style={st.section}>{isTag ? q : 'Beiträge'}</Text>
      {posts.isPending ? <Loading /> : posts.posts.length ? <PostGrid posts={posts.posts} /> : <Empty icon="search-outline" text={`Nichts gefunden zu „${q}“.`} />}
    </ScrollView>
  )
}

function PersonCard({ p }: { p: Profile }) {
  return (
    <Pressable style={st.personCard} onPress={() => router.push(`/profil/${p.id}`)}>
      <Avatar name={p.name} url={p.avatar_url} type={p.account_type} size={56} />
      <Text style={st.personName} numberOfLines={1}>{p.name}</Text>
      <Text style={st.personSub} numberOfLines={1}>{ACCOUNT_TYPES[p.account_type].label}</Text>
    </Pressable>
  )
}

function People() {
  const { me } = useMe()
  const [filter, setFilter] = useState(0)
  const profiles = useProfiles(FILTERS[filter].types)
  const list = (profiles.data ?? []).filter(p => p.id !== me)
  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
          {FILTERS.map((f, i) => <Chip key={f.label} label={f.label} active={filter === i} onPress={() => setFilter(i)} />)}
        </ScrollView>
      </View>
      {profiles.isPending ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, maxWidth: 680, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Empty icon="people-outline" text="Niemand gefunden." />}
          renderItem={({ item: p }) => (
            <Pressable style={st.row} onPress={() => router.push(`/profil/${p.id}`)}>
              <Avatar name={p.name} url={p.avatar_url} type={p.account_type} size={50} />
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
  searchWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 12, height: 44 },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.accent },
  segText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  section: { color: colors.text, fontWeight: '700', fontSize: 16, paddingHorizontal: 16 },
  personCard: { width: 120, alignItems: 'center', gap: 6, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface },
  personName: { color: colors.text, fontWeight: '600', fontSize: 13, maxWidth: 100 },
  personSub: { color: colors.faint, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  city: { color: colors.faint, fontSize: 12, marginTop: 2 },
})
