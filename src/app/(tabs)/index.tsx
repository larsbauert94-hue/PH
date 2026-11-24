import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useFeed } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { FEED_TABS } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { FeedTab } from '../../lib/types'
import PostCard from '../../components/PostCard'
import { Avatar, Chip, Empty, ErrorView, Loading } from '../../components/ui'

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
  const { profile } = useMe()
  const [tab, setTab] = useState<FeedTab>('alle')
  const feed = useFeed({ tab })
  const firstName = profile.name.split(' ')[0]

  const header = (
    <View style={{ gap: 12, marginBottom: 2 }}>
      <Pressable style={st.compose} onPress={() => router.navigate('/neu')} accessibilityRole="button" accessibilityLabel="Neuen Beitrag schreiben">
        <Avatar name={profile.name} url={profile.avatar_url} type={profile.account_type} size={38} />
        <Text style={st.composeText} numberOfLines={1}>Was gibt’s Neues, {firstName}?</Text>
        <View style={st.composeIcon}><Ionicons name="image-outline" size={20} color={colors.accent} /></View>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FEED_TABS.map(t => <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
      </ScrollView>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={feed.posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={feed.isPending ? <Loading /> : feed.isError ? <ErrorView error={feed.error} onRetry={feed.refetch} /> : <Empty icon="newspaper-outline" text={EMPTY[tab]} />}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ padding: 16 }} /> : undefined}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => { feed.refetch() }} tintColor={colors.accent} />}
      />
    </View>
  )
}

const st = StyleSheet.create({
  compose: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.pill, padding: 6, paddingRight: 8, borderWidth: 1, borderColor: colors.border },
  composeText: { flex: 1, color: colors.muted, fontSize: 15 },
  composeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
})
