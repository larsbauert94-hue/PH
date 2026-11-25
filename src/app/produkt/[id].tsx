import { useMemo } from 'react'
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useFeed, useProduct } from '../../lib/queries'
import { CATEGORIES } from '../../lib/labels'
import { colors, fonts, radius } from '../../lib/theme'
import PostCard from '../../components/PostCard'
import { DropRating } from '../../components/checkin'
import { Icon } from '../../components/Icon'
import { Button, Empty, ErrorView, Loading } from '../../components/ui'

/** Produktseite: Bewertungen aus Check-ins, wo es das gibt, Bestellen */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const product = useProduct(id)
  const checkins = useFeed({ productId: id })

  // Orte, an denen das Produkt eingecheckt wurde
  const places = useMemo(() => {
    const m = new Map<string, { id: string; name: string; city: string; count: number }>()
    for (const p of checkins.posts) {
      if (!p.venue_id || !p.venue_name) continue
      const e = m.get(p.venue_id) ?? { id: p.venue_id, name: p.venue_name, city: p.venue_city ?? '', count: 0 }
      e.count++
      m.set(p.venue_id, e)
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [checkins.posts])

  if (product.isPending) return <Loading />
  if (product.isError) return <ErrorView error={product.error} onRetry={product.refetch} />
  const p = product.data
  if (!p) return <Empty icon="wine-outline" text="Dieses Produkt gibt es nicht mehr." />

  const header = (
    <View style={{ gap: 16, marginBottom: 6 }}>
      <LinearGradient colors={['#1f2a5c', colors.surface]} style={st.hero}>
        <View style={st.bottle}><Icon name="wine-outline" size={40} color={colors.accent} /></View>
        <Text style={st.kicker}>{CATEGORIES[p.category].toUpperCase()}</Text>
        <Text style={st.name}>{p.name}</Text>
        {!!p.brand_name && (
          <Text style={st.brand} onPress={p.brand_id ? () => router.push(`/profil/${p.brand_id}`) : undefined}>{p.brand_name}</Text>
        )}
        <View style={st.ratingRow}>
          <DropRating value={p.avg_rating ?? 0} size={22} />
          <Text style={st.ratingText}>{p.avg_rating != null ? p.avg_rating.toFixed(1).replace('.', ',') : '–'}</Text>
          <Text style={st.count}>{p.checkin_count} {p.checkin_count === 1 ? 'Check-in' : 'Check-ins'}</Text>
        </View>
        {!!p.description && <Text style={st.desc}>{p.description}</Text>}
        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          <Button title="Einchecken" icon="cheers-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/neu', params: { checkin: '1' } })} />
          {p.shop_url && <Button title="Bestellen" icon="cart-outline" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(p.shop_url!)} />}
        </View>
      </LinearGradient>

      {places.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={st.section}>Hier gibt’s {p.name}</Text>
          {places.map(v => (
            <Pressable key={v.id} style={st.place} onPress={() => router.push(`/ort/${v.id}`)}>
              <Icon name="location-outline" size={18} color={colors.accent} />
              <Text style={st.placeName}>{v.name}</Text>
              <Text style={st.placeCity}>{v.city}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={st.section}>Check-ins</Text>
    </View>
  )

  return (
    <>
      <Stack.Screen options={{ title: p.name }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={checkins.posts}
        keyExtractor={x => x.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={checkins.isPending ? <Loading /> : <Empty icon="cheers-outline" text="Noch keine Check-ins. Sei die erste Person!" />}
        contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        onEndReached={checkins.loadMore}
      />
    </>
  )
}

const st = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border },
  bottle: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: 'rgba(227,165,133,0.45)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kicker: { color: colors.accentLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  brand: { color: colors.muted, fontSize: 15 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  ratingText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 13 },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 6 },
  section: { color: colors.text, fontSize: 17, fontWeight: '700' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  placeName: { color: colors.text, fontWeight: '600', flex: 1 },
  placeCity: { color: colors.muted, fontSize: 13 },
})
