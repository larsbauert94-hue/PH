import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMe } from '../lib/auth'
import { useConversations } from '../lib/queries'
import { subtitle, timeAgo } from '../lib/labels'
import { colors, radius } from '../lib/theme'
import { Avatar, Button, Empty, ErrorView, Loading } from '../components/ui'

export default function Inbox() {
  const { me } = useMe()
  const convs = useConversations()

  if (convs.isPending) return <Loading />
  if (convs.isError) return <ErrorView error={convs.error} onRetry={convs.refetch} />

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={convs.data}
      keyExtractor={c => c.id}
      contentContainerStyle={{ padding: 16, gap: 8, maxWidth: 680, width: '100%', alignSelf: 'center', flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={convs.isRefetching} onRefresh={() => { convs.refetch() }} tintColor={colors.accent} />}
      ListEmptyComponent={
        <View style={{ gap: 16, alignItems: 'center' }}>
          <Empty icon="chatbubbles-outline" text="Noch keine Nachrichten. Schreib Betrieben, Lieferanten oder Kolleg:innen direkt über ihr Profil." />
          <Button title="Leute finden" icon="people-outline" variant="secondary" onPress={() => router.navigate({ pathname: '/entdecken', params: { tab: 'personen' } })} />
        </View>
      }
      renderItem={({ item: c }) => {
        const unread = c.unread_count > 0
        const preview = c.last_body ? `${c.last_sender_id === me ? 'Du: ' : ''}${c.last_body}` : 'Noch keine Nachrichten'
        return (
          <Pressable style={st.row} onPress={() => router.push(`/chat/${c.id}`)} accessibilityLabel={`Unterhaltung mit ${c.other_name}${unread ? `, ${c.unread_count} ungelesen` : ''}`}>
            <Avatar name={c.other_name} url={c.other_avatar_url} type={c.other_type} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[st.name, unread && { fontWeight: '800' }]} numberOfLines={1}>{c.other_name}</Text>
                <Text style={st.time}>{timeAgo(c.last_message_at)}</Text>
              </View>
              <Text style={st.sub} numberOfLines={1}>{subtitle({ account_type: c.other_type, headline: c.other_headline })}</Text>
              <Text style={[st.preview, unread && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{preview}</Text>
            </View>
            {unread && <View style={st.dot} accessibilityElementsHidden />}
          </Pressable>
        )
      }}
    />
  )
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  time: { color: colors.faint, fontSize: 12, marginLeft: 'auto' },
  sub: { color: colors.faint, fontSize: 12 },
  preview: { color: colors.muted, fontSize: 14, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
})
