import { useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../../lib/auth'
import { useAddComment, useCommentLike, useComments, usePost } from '../../lib/queries'
import { timeAgo } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import PostCard from '../../components/PostCard'
import { RichText } from '../../components/media'
import MentionSuggest from '../../components/MentionSuggest'
import { Avatar, Empty, ErrorView, Loading } from '../../components/ui'
import { notify } from '../../components/report'

const QUICK = ['🍷', '🥂', '🍸', '🔥', '👏', '😍', '🙌']

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { profile } = useMe()
  const post = usePost(id)
  const comments = useComments(id)
  const add = useAddComment(id)
  const likeComment = useCommentLike(id)
  const [text, setText] = useState('')

  if (post.isPending) return <Loading />
  if (post.isError) return <ErrorView error={post.error} onRetry={post.refetch} />
  if (!post.data) return <Empty icon="trash-outline" text="Dieser Beitrag ist nicht mehr verfügbar." />

  const send = (body = text.trim()) => {
    if (!body) return
    add.mutate(body, { onSuccess: () => setText(''), onError: e => notify('Fehler', e.message) })
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <FlatList
        data={comments.data ?? []}
        keyExtractor={c => c.id}
        ListHeaderComponent={<View style={{ marginBottom: 8 }}><PostCard post={post.data} detail /></View>}
        contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={comments.isPending ? undefined : <Text style={st.none}>Noch keine Kommentare. Schreib den ersten!</Text>}
        renderItem={({ item: c }) => (
          <View style={st.comment}>
            <Link href={`/profil/${c.author_id}`} asChild>
              <Pressable><Avatar name={c.author_name} url={c.author_avatar_url} type={c.author_type} size={34} /></Pressable>
            </Link>
            <View style={{ flex: 1, gap: 4 }}>
              <RichText text={c.body} style={st.body} prefix={<Text style={st.author}>{c.author_handle} </Text>} />
              <View style={st.meta}>
                <Text style={st.time}>{timeAgo(c.created_at)}</Text>
                {c.like_count > 0 && <Text style={st.time}>{c.like_count === 1 ? '1 „Gefällt mir“' : `${c.like_count} „Gefällt mir“`}</Text>}
                <Pressable onPress={() => setText(`@${c.author_handle} `)} hitSlop={6}><Text style={[st.time, { fontWeight: '700' }]}>Antworten</Text></Pressable>
              </View>
            </View>
            <Pressable onPress={() => likeComment.mutate(c)} hitSlop={10} accessibilityLabel={c.liked_by_me ? 'Kommentar nicht mehr liken' : 'Kommentar liken'}>
              <Ionicons name={c.liked_by_me ? 'heart' : 'heart-outline'} size={16} color={c.liked_by_me ? colors.heart : colors.faint} />
            </Pressable>
          </View>
        )}
      />
      <View style={[st.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={st.quick}>
          {QUICK.map(e => (
            <Pressable key={e} onPress={() => setText(t => t + e)} hitSlop={4} accessibilityLabel={`Emoji ${e} einfügen`}>
              <Text style={st.emoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <MentionSuggest text={text} onChange={setText} />
        <View style={st.composer}>
          <Avatar name={profile.name} url={profile.avatar_url} type={profile.account_type} size={34} />
          <TextInput value={text} onChangeText={setText} placeholder={`Kommentieren als ${profile.handle} …`} placeholderTextColor={colors.faint} style={st.input} multiline maxLength={1000} />
          <Pressable onPress={() => send()} disabled={!text.trim() || add.isPending} accessibilityLabel="Kommentar posten" style={{ opacity: text.trim() ? 1 : 0.4 }}>
            <Text style={st.post}>Posten</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  none: { color: colors.faint, textAlign: 'center', padding: 16 },
  comment: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  author: { color: colors.text, fontWeight: '700', fontSize: 14 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 14 },
  time: { color: colors.faint, fontSize: 12 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
  quick: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, maxWidth: 420, width: '100%', alignSelf: 'center' },
  emoji: { fontSize: 24 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, color: colors.text, fontSize: 15, backgroundColor: colors.surface2, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  post: { color: colors.accent, fontWeight: '800', fontSize: 15 },
})
