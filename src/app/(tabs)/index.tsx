import { useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text , ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams, useScrollToTop } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useMe } from '../../lib/auth'
import { colors as c2, fonts , colors } from '../../lib/theme'
import { tap } from '../../components/motion'
import { useFeed, useStories } from '../../lib/queries'
import { FEED_TABS } from '../../lib/labels'
import type { FeedPost, FeedTab } from '../../lib/types'
import PostCard from '../../components/PostCard'
import StoryBar from '../../components/StoryBar'
import { Chip, Empty, ErrorView, Loading } from '../../components/ui'

const EMPTY: Record<FeedTab, string> = {
  fuerdich: 'Noch nichts für dich dabei. Folge Betrieben und Kolleg:innen, dann lernt der Feed dazu.',
  checkins: 'Noch keine Check-ins. Teile deinen ersten Drink über „Posten“ → Check-in.',
  rezepte: 'Noch keine Rezepte.',
  alle: 'Noch keine Beiträge. Sei die erste Person, die etwas teilt!',
  folge: 'Folge Betrieben und Kolleg:innen im Netzwerk, um hier ihre Beiträge zu sehen.',
  neuheiten: 'Noch keine Produktneuheiten.',
  handel: 'Noch keine Beiträge von Händlern, Lieferanten oder Marken.',
  gastro: 'Noch keine Beiträge von Bars und Restaurants.',
  jobs: 'Gerade keine offenen Stellen.',
  events: 'Gerade keine Events.',
}

export default function Feed() {
  const [tab, setTab] = useState<FeedTab>('fuerdich')
  // Nach dem Posten zurück auf „Für dich“ (dort steht der neue Beitrag oben)
  const { posted } = useLocalSearchParams<{ posted?: string }>()
  const [seenPosted, setSeenPosted] = useState(posted)
  if (posted !== seenPosted) { setSeenPosted(posted); setTab('fuerdich') }
  const feed = useFeed({ tab })
  const stories = useStories()
  // Erneutes Tippen auf „Feed“ scrollt nach oben
  const list = useRef<FlatList<FeedPost>>(null)
  useScrollToTop(list)

  const { profile } = useMe()
  const mood = moodFor(new Date().getHours())
  // Wischen vom linken Rand: Story erstellen; vom rechten Rand: Nachrichten
  // Breite und Startpunkt werden erst während der Geste gelesen, nicht beim Rendern
  const edge = useRef({ x: 0, width: 390 })
  // eslint-disable-next-line react-hooks/refs
  const [swipe] = useState(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: e => { edge.current.x = e.nativeEvent.pageX; return false },
    onMoveShouldSetPanResponderCapture: (_e, g) => {
      const x = edge.current.x
      return Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2 && (x < 28 || x > edge.current.width - 28)
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dx > 70 && edge.current.x < 28) { tap('medium'); router.push('/story/neu') }
      else if (g.dx < -70) { tap('medium'); router.push('/nachrichten') }
    },
  }))

  const header = (
    <View style={{ gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
      <Text style={st.greeting}>{mood.greeting}, {profile.name.split(' ')[0]}<Text style={{ color: c2.accentLight }}> {mood.emoji}</Text></Text>
      <StoryBar />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FEED_TABS.map(t => <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
      </ScrollView>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={e => { edge.current.width = e.nativeEvent.layout.width }} {...swipe.panHandlers}>
      {/* Abendstimmung: warmes Barlicht von oben, morgens kühles Blau */}
      <LinearGradient colors={[mood.glow, 'transparent']} style={st.glow} pointerEvents="none" />
      <FlatList
        ref={list}
        data={feed.posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 24, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={feed.isPending ? <Loading /> : feed.isError ? <ErrorView error={feed.error} onRetry={feed.refetch} /> : <Empty icon="newspaper-outline" text={EMPTY[tab]} />}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ padding: 16 }} /> : undefined}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => { feed.refetch(); stories.refetch() }} tintColor={colors.accent} />}
      />
    </View>
  )
}

/** Stimmung nach Tageszeit: abends wärmer wie Barlicht */
function moodFor(h: number) {
  if (h >= 18 || h < 4) return { greeting: 'Guten Abend', emoji: '🥂', glow: 'rgba(196,120,90,0.22)' }
  if (h < 11) return { greeting: 'Guten Morgen', emoji: '☕', glow: 'rgba(143,153,230,0.14)' }
  if (h < 16) return { greeting: 'Hallo', emoji: '🍋', glow: 'rgba(238,185,153,0.10)' }
  return { greeting: 'Schönen Feierabend', emoji: '🍷', glow: 'rgba(196,120,90,0.16)' }
}

const st = StyleSheet.create({
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 260 },
  greeting: { color: c2.text, fontFamily: fonts.serif, fontSize: 20, fontWeight: '700', marginTop: 4 },
})
