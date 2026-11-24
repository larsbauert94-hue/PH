import { FlatList, Linking, StyleSheet, Text, View } from 'react-native'
import { Link, Stack, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useFeed, useProfile, useVenue } from '../../lib/queries'
import { VENUE_TYPES } from '../../lib/labels'
import { openRoute } from '../../lib/geo'
import { colors, fonts, radius } from '../../lib/theme'
import PostCard from '../../components/PostCard'
import { Avatar, Badge, Button, Empty, ErrorView, Loading, SectionLabel, Verified } from '../../components/ui'

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const venue = useVenue(id)
  const posts = useFeed({ venueId: id })
  const owner = useProfile(venue.data?.owner_id ?? '')

  if (venue.isPending) return <Loading />
  if (venue.isError) return <ErrorView error={venue.error} onRetry={venue.refetch} />
  const v = venue.data
  if (!v) return <Empty icon="location-outline" text="Diesen Ort gibt es nicht mehr." />
  const t = VENUE_TYPES[v.type]

  const header = (
    <View style={{ gap: 16, marginBottom: 6 }}>
      <View style={[st.hero, { borderColor: t.color + '55' }]}>
        <Ionicons name={v.type === 'restaurant' ? 'restaurant' : 'wine'} size={36} color={t.color} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={st.name}>{v.name}</Text>
        <Badge label={t.label} color={t.color} />
        <Text style={st.address}><Ionicons name="location-outline" size={14} /> {v.address}, {v.city}</Text>
        {v.description ? <Text style={st.desc}>{v.description}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Route" icon="navigate" style={{ flex: 1 }} onPress={() => openRoute(v, v.name)} />
        {v.phone && <Button title="Anrufen" icon="call-outline" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${v.phone}`)} />}
        {v.website && <Button title="Website" icon="globe-outline" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(v.website!)} />}
      </View>
      {owner.data && (
        <Link href={`/profil/${owner.data.id}`} style={st.owner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={owner.data.name} url={owner.data.avatar_url} type={owner.data.account_type} size={36} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>{owner.data.name} </Text>
            {owner.data.verified && <Verified />}
            <Text style={{ color: colors.muted }}>ist auf Pour</Text>
          </View>
        </Link>
      )}
      <SectionLabel>Beiträge von hier</SectionLabel>
    </View>
  )

  return (
    <>
      <Stack.Screen options={{ title: v.name }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={posts.posts}
        keyExtractor={p => p.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        onEndReached={posts.loadMore}
        ListEmptyComponent={posts.isPending ? <Loading /> : <Empty icon="chatbubbles-outline" text="Noch niemand hat diesen Ort markiert." />}
      />
    </>
  )
}

const st = StyleSheet.create({
  hero: { height: 120, borderRadius: radius.xl, borderWidth: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 28, fontWeight: '700' },
  address: { color: colors.muted, fontSize: 14 },
  desc: { color: colors.text, fontSize: 15, lineHeight: 22, opacity: 0.9 },
  owner: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
})
