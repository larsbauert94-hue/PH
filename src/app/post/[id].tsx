import { useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAddComment, useComments, usePost } from '../../lib/queries'
import { timeAgo } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import PostCard from '../../components/PostCard'
import { Avatar, Empty, ErrorView, Loading } from '../../components/ui'
import { notify } from '../../components/report'

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const post = usePost(id)
  const comments = useComments(id)
  const add = useAddComment(id)
  const [text, setText] = useState('')

  if (post.isPending) return <Loading />
  if (post.isError) return <ErrorView error={post.error} onRetry={post.refetch} />
  if (!post.data) return <Empty icon="trash-outline" text="Dieser Beitrag ist nicht mehr verfügbar." />

  const send = () => {
    const body = text.trim()
    if (!body) return
    add.mutate(body, { onSuccess: () => setText(''), onError: e => notify('Fehler', e.message) })
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <FlatList
        data={comments.data ?? []}
        keyExtractor={c => c.id}
        ListHeaderComponent={<View style={{ marginBottom: 8 }}><PostCard post={post.data} detail /></View>}
        contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={comments.isPending ? undefined : <Text style={st.none}>Noch keine Kommentare.</Text>}
        renderItem={({ item: c }) => (
          <View style={st.comment}>
            <Link href={`/profil/${c.author_id}`} asChild>
              <Pressable><Avatar name={c.author_name} url={c.author_avatar_url} type={c.author_type} size={34} /></Pressable>
            </Link>
            <View style={st.bubble}>
              <Text style={st.author}>{c.author_name} <Text style={st.time}>· {timeAgo(c.created_at)}</Text></Text>
              <Text style={st.body}>{c.body}</Text>
            </View>
          </View>
        )}
      />
      <View style={[st.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput value={text} onChangeText={setText} placeholder="Kommentieren …" placeholderTextColor={colors.faint} style={st.input} multiline maxLength={1000} />
        <Pressable onPress={send} disabled={!text.trim() || add.isPending} accessibilityLabel="Senden" style={{ opacity: text.trim() ? 1 : 0.4 }}>
          <Ionicons name="send" size={22} color={colors.amber} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  none: { color: colors.faint, textAlign: 'center', padding: 16 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bubble: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, gap: 4 },
  author: { color: colors.text, fontWeight: '600', fontSize: 14 },
  time: { color: colors.faint, fontWeight: '400', fontSize: 12 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21, opacity: 0.92 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, color: colors.text, fontSize: 15, backgroundColor: colors.surface2, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
})
