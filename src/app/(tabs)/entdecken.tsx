import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Icon } from '../../components/Icon'
import { useFeed, useGroups, useProducts, useProfiles, useVenues } from '../../lib/queries'
import { LinearGradient } from 'expo-linear-gradient'
import { DropRating } from '../../components/checkin'
import { currentChallenge } from '../../lib/challenge'
import { useMe } from '../../lib/auth'
import { ACCOUNT_TYPES, VENUE_TYPES, subtitle } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { AccountType, Profile, Venue } from '../../lib/types'
import { Avatar, Button, Chip, Empty, Loading, Verified } from '../../components/ui'
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
  const [mode, setMode] = useState<'fuerdich' | 'personen' | 'orte' | 'raeume'>(params.tab === 'personen' ? 'personen' : 'fuerdich')
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
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Suchen: Leute, Betriebe, #hashtags" placeholderTextColor={colors.faint} style={st.input} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Suche löschen"><Icon name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
        {!q && (
          <View style={st.segment}>
            {([['fuerdich', 'Für dich'], ['personen', 'Personen'], ['orte', 'Orte'], ['raeume', 'Räume']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setMode(k)} style={[st.segItem, mode === k && st.segActive]}>
                <Text style={[st.segText, mode === k && { color: colors.onAccent }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {q ? <SearchResults q={q} /> : mode === 'fuerdich' ? <ForYou onTag={setQuery} /> : mode === 'orte' ? <Places /> : mode === 'raeume' ? <Rooms /> : <People />}
    </View>
  )
}

/** Challenge der Woche: Beiträge mit dem Hashtag, die meisten „Prost“ gewinnen */
function ChallengeBanner() {
  const c = currentChallenge()
  const top = useFeed({ search: c.tag, sort: 'top' })
  const leader = top.posts[0]
  return (
    <LinearGradient colors={['#3a2350', '#1a2349']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.challenge}>
      <Text style={st.chKicker}>CHALLENGE DER WOCHE · NOCH {c.daysLeft} {c.daysLeft === 1 ? 'TAG' : 'TAGE'}</Text>
      <Text style={st.chTitle}>{c.title}</Text>
      <Text style={st.chText}>{c.text} Teile deinen Beitrag mit <Text style={{ color: colors.accent, fontWeight: '700' }}>{c.tag}</Text>, die meisten „Prost“ landen ganz oben.</Text>
      {leader && <Text style={st.chLead} onPress={() => router.push(`/post/${leader.id}`)}>🏆 Vorne: {leader.author_name} · {leader.like_count}× angestoßen</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Mitmachen" style={{ flex: 1, height: 40 }} onPress={() => router.push({ pathname: '/neu', params: { tag: c.tag, t: String(Date.now()) } })} />
        <Button title="Beiträge" variant="secondary" style={{ flex: 1, height: 40 }} onPress={() => router.push({ pathname: '/entdecken', params: { q: c.tag } })} />
      </View>
    </LinearGradient>
  )
}

function TopProducts() {
  const products = useProducts()
  const list = (products.data ?? []).filter(p => p.checkin_count > 0).slice(0, 10)
  if (!list.length) return null
  return (
    <View style={{ gap: 8, paddingBottom: 14 }}>
      <Text style={st.section}>Beliebte Flaschen</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {list.map(p => (
          <Pressable key={p.id} style={st.product} onPress={() => router.push(`/produkt/${p.id}`)} accessibilityLabel={p.name}>
            <Icon name="wine-outline" size={22} color={colors.accent} />
            <Text style={st.productName} numberOfLines={2}>{p.name}</Text>
            <Text style={st.productBrand} numberOfLines={1}>{p.brand_name}</Text>
            {p.avg_rating != null && <DropRating value={p.avg_rating} size={11} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function Rooms() {
  const groups = useGroups()
  return (
    <FlatList
      data={groups.data ?? []}
      keyExtractor={g => g.id}
      contentContainerStyle={{ padding: 16, gap: 10, maxWidth: 680, width: '100%', alignSelf: 'center' }}
      ListHeaderComponent={<Button title="Raum gründen" icon="add" variant="secondary" style={{ marginBottom: 6 }} onPress={() => router.push('/raum/neu')} />}
      ListEmptyComponent={groups.isPending ? <Loading /> : <Empty icon="people-outline" text="Noch keine Räume." />}
      renderItem={({ item: g }) => (
        <Pressable style={st.room} onPress={() => router.push(`/raum/${g.id}`)} accessibilityLabel={`Raum ${g.name}`}>
          <Text style={{ fontSize: 30 }}>{g.emoji}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.roomName} numberOfLines={1}>{g.name}</Text>
            <Text style={st.roomMeta} numberOfLines={1}>
              {g.starts_at ? `Live-Tasting · ${new Date(g.starts_at).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ` : ''}{g.member_count} Mitglieder{g.joined_by_me ? ' · beigetreten' : ''}
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      )}
    />
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
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}><ChallengeBanner /></View>
      <TopProducts />
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
  const venues = useVenues()
  const n = q.toLowerCase()
  const places = isTag ? [] : (venues.data ?? []).filter(v => `${v.name} ${v.city}`.toLowerCase().includes(n)).slice(0, 12)
  const products = useProducts(isTag ? '§' : q)
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
      {places.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={st.section}>Orte</Text>
          <View style={{ paddingHorizontal: 16, gap: 8 }}>{places.map(v => <PlaceRow key={v.id} v={v} />)}</View>
        </View>
      )}
      {!isTag && !!products.data?.length && (
        <View style={{ gap: 8 }}>
          <Text style={st.section}>Flaschen & Drinks</Text>
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {products.data.slice(0, 6).map(p => (
              <Pressable key={p.id} style={st.row} onPress={() => router.push(`/produkt/${p.id}`)}>
                <Icon name="wine-outline" size={22} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={st.productName}>{p.name}</Text>
                  <Text style={st.productBrand}>{p.brand_name}</Text>
                </View>
                {p.avg_rating != null && <DropRating value={p.avg_rating} size={12} />}
              </Pressable>
            ))}
          </View>
        </View>
      )}
      <Text style={st.section}>{isTag ? q : 'Beiträge'}</Text>
      {posts.isPending ? <Loading /> : posts.posts.length ? <PostGrid posts={posts.posts} /> : <Empty icon="search-outline" text={`Nichts gefunden zu „${q}“.`} />}
    </ScrollView>
  )
}

function PlaceRow({ v }: { v: Venue }) {
  const t = VENUE_TYPES[v.type]
  return (
    <Pressable style={st.row} onPress={() => router.push(`/ort/${v.id}`)}>
      <View style={[st.placeIcon, { backgroundColor: t.color + '22' }]}>
        <Icon name="location" size={22} color={t.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.name} numberOfLines={1}>{v.name}</Text>
        <Text style={st.meta} numberOfLines={1}>{t.label} · {v.city} · {v.post_count ?? 0} Beiträge</Text>
      </View>
      {v.saved_by_me && <Icon name="bookmark" size={16} color={colors.accent} />}
      <Icon name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  )
}

/** Orte: meistgepostete zuerst, gemerkte oben */
function Places() {
  const venues = useVenues()
  const [type, setType] = useState<string | null>(null)
  const list = [...(venues.data ?? [])]
    .filter(v => !type || v.type === type)
    .sort((a, b) => Number(!!b.saved_by_me) - Number(!!a.saved_by_me) || (b.post_count ?? 0) - (a.post_count ?? 0))
  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
          <Chip label="Alle" active={!type} onPress={() => setType(null)} />
          {Object.entries(VENUE_TYPES).map(([k, t]) => <Chip key={k} label={t.label} active={type === k} onPress={() => setType(type === k ? null : k)} />)}
        </ScrollView>
      </View>
      {venues.isPending ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={v => v.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, maxWidth: 680, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Empty icon="location-outline" text="Keine Orte gefunden." />}
          renderItem={({ item }) => <PlaceRow v={item} />}
        />
      )}
    </View>
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
              <Icon name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  challenge: { padding: 16, borderRadius: radius.xl, gap: 8, borderWidth: 1, borderColor: 'rgba(143,153,230,0.35)' },
  chKicker: { color: colors.lavender, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  chTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  chText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  chLead: { color: colors.accentLight, fontSize: 13, fontWeight: '700' },
  product: { width: 130, gap: 4, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  productName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  productBrand: { color: colors.muted, fontSize: 11 },
  room: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  roomName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  roomMeta: { color: colors.muted, fontSize: 12 },
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
  placeIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
})
