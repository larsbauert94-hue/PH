import { useState , useMemo } from 'react'
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Link, Stack, router, useLocalSearchParams } from 'expo-router'
import { Icon } from '../../components/Icon'
import * as ExpoLinking from 'expo-linking'
import { useFeed, useProfile, useVenue, useVenueSave, useVenueStories } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { VenueCard } from '../../components/VenueCard'
import { DropRating } from '../../components/checkin'
import { VENUE_TYPES } from '../../lib/labels'
import { openRoute } from '../../lib/geo'
import { colors, fonts, radius } from '../../lib/theme'
import MiniMap from '../../components/map/MiniMap'
import { PostGrid } from '../../components/media'
import { StoryRing } from '../../components/StoryBar'
import { Avatar, Badge, Empty, ErrorView, IconName, Loading, Verified } from '../../components/ui'

type Tab = 'top' | 'neu' | 'reels'

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const venue = useVenue(id)
  const owner = useProfile(venue.data?.owner_id ?? '')
  const save = useVenueSave(id)
  const stories = useVenueStories(id)
  const [tab, setTab] = useState<Tab>('top')
  const { me } = useMe()
  const checkins = useFeed({ venueId: id, tab: 'checkins' })
  // Top-Drinks: bestbewertete Produkte und Drinks aus den Check-ins hier
  const topDrinks = useMemo(() => {
    const m = new Map<string, { key: string; name: string; productId: string | null; sum: number; n: number }>()
    for (const p of checkins.posts) {
      if (p.rating == null) continue
      const name = p.product_name ?? p.body.split(/[.!,]/)[0].slice(0, 40)
      const key = p.product_id ?? name
      const e = m.get(key) ?? { key, name, productId: p.product_id ?? null, sum: 0, n: 0 }
      e.sum += p.rating; e.n++
      m.set(key, e)
    }
    return [...m.values()].sort((a, b) => b.sum / b.n - a.sum / a.n || b.n - a.n).slice(0, 5)
  }, [checkins.posts])
  const posts = useFeed(tab === 'top' ? { venueId: id, sort: 'top' } : tab === 'reels' ? { venueId: id, reels: true } : { venueId: id })

  if (venue.isPending) return <Loading />
  if (venue.isError) return <ErrorView error={venue.error} onRetry={venue.refetch} />
  const v = venue.data
  if (!v) return <Empty icon="location-outline" text="Diesen Ort gibt es nicht mehr." />
  const t = VENUE_TYPES[v.type]

  // Storys je Person (ein Ring pro Person)
  const storyAuthors = [...new Map((stories.data ?? []).map(s => [s.author_id, s])).values()]

  const share = () => Share.share({ message: `${v.name}, ${v.address}, ${v.city}\n${ExpoLinking.createURL(`/ort/${v.id}`)}` }).catch(() => {})
  const actions: { icon: IconName; label: string; onPress: () => void; active?: boolean }[] = [
    { icon: v.saved_by_me ? 'bookmark' : 'bookmark-outline', label: v.saved_by_me ? 'Gemerkt' : 'Merken', onPress: () => save.mutate(!v.saved_by_me), active: v.saved_by_me },
    { icon: 'navigate-outline', label: 'Route', onPress: () => openRoute(v, v.name) },
    { icon: 'paper-plane-outline', label: 'Senden', onPress: share },
    { icon: 'albums-outline', label: 'Sammlung', onPress: () => router.push({ pathname: '/sammlungen/hinzufuegen', params: { venue: v.id } }) },
    ...(v.phone ? [{ icon: 'call-outline' as IconName, label: 'Anrufen', onPress: () => Linking.openURL(`tel:${v.phone}`) }] : []),
    ...(v.website ? [{ icon: 'globe-outline' as IconName, label: 'Website', onPress: () => Linking.openURL(v.website!) }] : []),
  ]

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y > contentSize.height - 400) posts.loadMore()
  }

  return (
    <>
      <Stack.Screen options={{ title: v.name }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 32 }} onScroll={onScroll} scrollEventThrottle={200}>
        <MiniMap venue={v} />
        <View style={st.info}>
          <Text style={st.name}>{v.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge label={t.label} color={t.color} />
            <Text style={st.meta}>{v.post_count ?? 0} Beiträge</Text>
          </View>
          <Pressable onPress={() => openRoute(v, v.name)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="location-outline" size={15} color={colors.muted} /><Text style={[st.address, { flexShrink: 1 }]}>{v.address}, {v.city}</Text></View>
          </Pressable>
          {v.description ? <Text style={st.desc}>{v.description}</Text> : null}
        </View>

        {(v.opens || v.happy_hour || v.reservation_url) && <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}><VenueCard venue={v} compact /></View>}
        {v.owner_id === me && (
          <Pressable style={st.edit} onPress={() => router.push({ pathname: '/ort/neu', params: { edit: v.id } })} accessibilityRole="button">
            <Icon name="create-outline" size={18} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>Öffnungszeiten, Happy Hour & Reservierung bearbeiten</Text>
            <Icon name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        )}

        <View style={st.actions}>
          {actions.map(a => (
            <Pressable key={a.label} style={st.action} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}>
              <View style={[st.actionIcon, a.active && { backgroundColor: colors.accent }]}>
                <Icon name={a.icon} size={20} color={a.active ? colors.onAccent : colors.text} />
              </View>
              <Text style={st.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {owner.data && (
          <Link href={`/profil/${owner.data.id}`} asChild>
            <Pressable style={st.owner}>
              <Avatar name={owner.data.name} url={owner.data.avatar_url} type={owner.data.account_type} size={36} />
              <Text style={{ color: colors.text, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{owner.data.name}</Text>
              {owner.data.verified && <Verified />}
              <Text style={{ color: colors.muted, marginLeft: 'auto' }}>Profil ansehen</Text>
            </Pressable>
          </Link>
        )}

        {storyAuthors.length > 0 && (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={st.section}>Storys von hier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}>
              {storyAuthors.map(s => (
                <Pressable key={s.author_id} style={{ alignItems: 'center', gap: 4, width: 70 }} onPress={() => router.push(`/story/${s.author_id}`)} accessibilityLabel={`Story von ${s.author_name}`}>
                  <StoryRing name={s.author_name} url={s.author_avatar_url} type={s.author_type} size={62} seen={s.seen_by_me} />
                  <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>{s.author_name.split(' ')[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {topDrinks.length > 0 && (
          <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={[st.section, { paddingHorizontal: 0 }]}>Top-Drinks hier</Text>
            {topDrinks.map((d, i) => (
              <Pressable key={d.key} style={st.drink} disabled={!d.productId} onPress={() => d.productId && router.push(`/produkt/${d.productId}`)}>
                <Text style={st.rank}>{i + 1}</Text>
                <Text style={st.drinkName} numberOfLines={1}>{d.name}</Text>
                <DropRating value={d.sum / d.n} size={12} />
                <Text style={st.drinkN}>{d.n}×</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={st.tabs}>
          {([['top', 'Top'], ['neu', 'Neueste'], ['reels', 'Reels']] as const).map(([k, label]) => (
            <Pressable key={k} style={[st.tab, tab === k && st.tabActive]} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
              <Text style={[st.tabText, tab === k && { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {posts.isPending ? <Loading /> : posts.posts.length ? <PostGrid posts={posts.posts} /> : (
          <Empty icon="camera-outline" text={tab === 'reels' ? 'Noch keine Reels von hier.' : 'Noch niemand hat diesen Ort markiert. Sei die erste Person!'} />
        )}
      </ScrollView>
    </>
  )
}

const st = StyleSheet.create({
  info: { padding: 16, gap: 8 },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 28, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  address: { color: colors.accentLight, fontSize: 14 },
  desc: { color: colors.text, fontSize: 15, lineHeight: 22, opacity: 0.9 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 14 },
  action: { alignItems: 'center', gap: 6, minWidth: 60 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.text, fontSize: 12 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  drink: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface },
  rank: { color: colors.accent, fontWeight: '800', width: 16 },
  drinkName: { color: colors.text, fontWeight: '600', flex: 1 },
  drinkN: { color: colors.muted, fontSize: 12 },
  section: { color: colors.text, fontWeight: '700', fontSize: 15, paddingHorizontal: 16 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },
  tabText: { color: colors.faint, fontWeight: '700' },
})
