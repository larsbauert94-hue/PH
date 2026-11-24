import { useEffect } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Icon } from '../components/Icon'
import { useMarkNotificationsRead, useNotifications } from '../lib/queries'
import { timeAgo } from '../lib/labels'
import { colors, radius } from '../lib/theme'
import type { AppNotification } from '../lib/types'
import { Avatar, Empty, ErrorView, IconName, Loading } from '../components/ui'

const TEXT: Record<AppNotification['type'], { verb: string; icon: IconName; color: string }> = {
  like: { verb: 'gefällt dein Beitrag', icon: 'heart', color: colors.heart },
  comment: { verb: 'hat deinen Beitrag kommentiert', icon: 'chatbubble', color: colors.lavender },
  follow: { verb: 'folgt dir jetzt', icon: 'person-add', color: colors.accent },
  mention: { verb: 'hat dich erwähnt', icon: 'at', color: colors.lavender },
}

export default function Notifications() {
  const notes = useNotifications()
  const markRead = useMarkNotificationsRead()

  // Beim Verlassen alles als gelesen markieren, damit „neu“ beim Ansehen sichtbar bleibt
  const { mutate } = markRead
  useEffect(() => () => mutate(), [mutate])

  if (notes.isPending) return <Loading />
  if (notes.isError) return <ErrorView error={notes.error} onRetry={notes.refetch} />

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={notes.data}
      keyExtractor={n => n.id}
      contentContainerStyle={{ padding: 16, gap: 8, maxWidth: 680, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={notes.isRefetching} onRefresh={() => { notes.refetch() }} tintColor={colors.accent} />}
      ListEmptyComponent={<Empty icon="notifications-outline" text="Noch keine Mitteilungen. Hier siehst du Likes, Kommentare und neue Follower." />}
      renderItem={({ item: n }) => {
        const t = TEXT[n.type]
        const open = () => router.push(n.post_id ? `/post/${n.post_id}` : `/profil/${n.actor_id}`)
        return (
          <Pressable style={[st.row, !n.read_at && st.unread]} onPress={open}>
            <View>
              <Avatar name={n.actor_name} url={n.actor_avatar_url} type={n.actor_type} size={46} />
              <View style={[st.icon, { backgroundColor: t.color }]}><Icon name={t.icon} size={11} color="#fff" /></View>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.text}><Text style={{ fontWeight: '700' }}>{n.actor_name}</Text> {t.verb}</Text>
              {n.post_snippet && <Text style={st.snippet} numberOfLines={1}>„{n.post_snippet}“</Text>}
              <Text style={st.time}>{timeAgo(n.created_at)}</Text>
            </View>
            {!n.read_at && <View style={st.dot} />}
          </Pressable>
        )
      }}
    />
  )
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface },
  unread: { borderWidth: 1, borderColor: 'rgba(227,165,133,0.45)' },
  icon: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  snippet: { color: colors.muted, fontSize: 13 },
  time: { color: colors.faint, fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
})
