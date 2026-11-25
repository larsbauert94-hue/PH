import { useRef, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { useScrollToTop } from 'expo-router'
import { useFeed, useStories } from '../../lib/queries'
import { FEED_TABS } from '../../lib/labels'
import { colors } from '../../lib/theme'
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
  const feed = useFeed({ tab })
  const stories = useStories()
  // Erneutes Tippen auf „Feed“ scrollt nach oben
  const list = useRef<FlatList<FeedPost>>(null)
  useScrollToTop(list)

  const header = (
    <View style={{ gap: 14, marginBottom: 2 }}>
      <StoryBar />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FEED_TABS.map(t => <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
      </ScrollView>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={list}
        data={feed.posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={feed.isPending ? <Loading /> : feed.isError ? <ErrorView error={feed.error} onRetry={feed.refetch} /> : <Empty icon="newspaper-outline" text={EMPTY[tab]} />}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ padding: 16 }} /> : undefined}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => { feed.refetch(); stories.refetch() }} tintColor={colors.accent} />}
      />
    </View>
  )
}
