import { useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useFeed, useGroup, useJoinGroup } from '../../lib/queries'
import { colors, fonts, radius } from '../../lib/theme'
import PostCard from '../../components/PostCard'
import { Button, Empty, ErrorView, Loading } from '../../components/ui'
import { useClock } from '../../components/PourDrop'

/** Raum: Austausch einer Gruppe, optional als Live-Tasting mit Startzeit */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const group = useGroup(id)
  const posts = useFeed({ groupId: id })
  const join = useJoinGroup(id)

  if (group.isPending) return <Loading />
  if (group.isError) return <ErrorView error={group.error} onRetry={group.refetch} />
  const g = group.data
  if (!g) return <Empty icon="people-outline" text="Diesen Raum gibt es nicht mehr." />

  const header = (
    <View style={{ gap: 14, padding: 16, paddingBottom: 8 }}>
      <LinearGradient colors={['#23306a', colors.surface]} style={st.hero}>
        <Text style={st.emoji}>{g.emoji}</Text>
        <Text style={st.name}>{g.name}</Text>
        <Text style={st.meta}>{g.member_count} {g.member_count === 1 ? 'Mitglied' : 'Mitglieder'}{g.city ? ` · ${g.city}` : ''}</Text>
        {!!g.description && <Text style={st.desc}>{g.description}</Text>}
        {g.starts_at && <Countdown at={g.starts_at} />}
        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          <Button
            title={g.joined_by_me ? 'Beigetreten' : 'Beitreten'}
            variant={g.joined_by_me ? 'secondary' : 'primary'}
            style={{ flex: 1 }}
            loading={join.isPending}
            onPress={() => join.mutate(!g.joined_by_me)}
          />
          {g.joined_by_me && (
            <Button title={g.starts_at ? 'Frage stellen' : 'Beitrag schreiben'} icon="create-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/neu', params: { group: g.id, t: String(Date.now()) } })} />
          )}
        </View>
      </LinearGradient>
    </View>
  )

  return (
    <>
      <Stack.Screen options={{ title: g.name }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={posts.posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={posts.isPending ? <Loading /> : <Empty icon="chatbubbles-outline" text="Noch keine Beiträge in diesem Raum." />}
        contentContainerStyle={{ paddingBottom: 24, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        onEndReached={posts.loadMore}
      />
    </>
  )
}

/** Countdown bis zum Live-Tasting */
function Countdown({ at }: { at: string }) {
  const t = useClock()
  const [start] = useState(() => Date.now())
  const ms = new Date(at).getTime() - (start + t * 1000)
  const live = ms <= 0 && ms > -2 * 3_600_000
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000), sec = Math.floor((ms % 60_000) / 1000)
  return (
    <View style={[st.count, live && { borderColor: colors.heart }]}>
      <Text style={[st.countKicker, live && { color: colors.heart }]}>{live ? '● JETZT LIVE' : ms > 0 ? 'LIVE-TASTING IN' : 'LIVE-TASTING BEENDET'}</Text>
      {ms > 0 && <Text style={st.countTime}>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}</Text>}
      <Text style={st.countDate}>{new Date(at).toLocaleString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr</Text>
    </View>
  )
}

const st = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border },
  emoji: { fontSize: 44 },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  meta: { color: colors.muted, fontSize: 13 },
  desc: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: 'center', opacity: 0.9, marginBottom: 6 },
  count: { alignItems: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(227,165,133,0.4)', marginBottom: 6 },
  countKicker: { color: colors.accentLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  countTime: { color: colors.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countDate: { color: colors.muted, fontSize: 12 },
})
