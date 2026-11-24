import { useState } from 'react'
import { FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { useFeed } from '../../lib/queries'
import { FEED_TABS } from '../../lib/labels'
import { colors } from '../../lib/theme'
import type { FeedTab } from '../../lib/types'
import PostCard from '../../components/PostCard'
import { Chip, Empty, ErrorView, Loading } from '../../components/ui'

const EMPTY: Record<FeedTab, string> = {
  alle: 'Noch keine Beiträge. Sei die erste Person, die etwas teilt!',
  folge: 'Folge Betrieben und Kolleg:innen im Netzwerk, um hier ihre Beiträge zu sehen.',
  neuheiten: 'Noch keine Produktneuheiten.',
  handel: 'Noch keine Beiträge von Händlern, Lieferanten oder Marken.',
  gastro: 'Noch keine Beiträge von Bars und Restaurants.',
  jobs: 'Gerade keine offenen Stellen.',
  events: 'Gerade keine Events.',
}

export default function Feed() {
  const [tab, setTab] = useState<FeedTab>('alle')
  const feed = useFeed({ tab })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
          {FEED_TABS.map(t => <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
        </ScrollView>
      </View>
      {feed.isPending ? <Loading /> : feed.isError ? <ErrorView error={feed.error} onRetry={feed.refetch} /> : (
        <FlatList
          data={feed.data}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={<Empty icon="newspaper-outline" text={EMPTY[tab]} />}
          refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { feed.refetch() }} tintColor={colors.accent} />}
        />
      )}
    </View>
  )
}
