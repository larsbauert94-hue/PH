import { memo } from 'react'
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import * as ExpoLinking from 'expo-linking'
import { Link, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { FeedPost } from '../lib/types'
import { POST_KINDS, subtitle, timeAgo } from '../lib/labels'
import { colors, fonts, radius } from '../lib/theme'
import { useMe } from '../lib/auth'
import { useDeletePost, useStartConversation, useToggleLike, useToggleSave } from '../lib/queries'
import { chooseAction, confirmAction, notify, reportFlow } from './report'
import { MediaCarousel, ReelPlayer, ReelPreview, RichText } from './media'
import { MusicLine } from './music'
import { Avatar, Badge, IconName, Verified } from './ui'

const KIND_COLORS = { beitrag: colors.muted, neuheit: colors.accent, angebot: '#7cc47f', event: colors.lavender, job: colors.heart }
const CTA: Partial<Record<FeedPost['kind'], string>> = { job: 'Jetzt bewerben', angebot: 'Angebot anfragen', neuheit: 'Mehr erfahren' }

function PostCard({ post, detail = false }: { post: FeedPost; detail?: boolean }) {
  const { me } = useMe()
  const like = useToggleLike()
  const save = useToggleSave()
  const del = useDeletePost()
  const startChat = useStartConversation()
  const kind = POST_KINDS[post.kind]
  const mine = post.author_id === me
  const hasMedia = post.media.length > 0 || !!post.video_url

  const share = () => {
    const text = [post.title, post.body].filter(Boolean).join('\n\n')
    Share.share({ message: `${text}\n\n– ${post.author_name} auf Pour\n${ExpoLinking.createURL(`/post/${post.id}`)}` }).catch(() => {})
  }
  const contact = () => startChat.mutate(post.author_id, {
    onSuccess: id => router.push(`/chat/${id}`),
    onError: e => notify('Nachricht', e.message),
  })
  const likeOnce = () => { if (!post.liked_by_me) like.mutate(post) }
  const menu = () => chooseAction('Beitrag', mine ? [
    { label: 'Teilen über …', onPress: share },
    { label: 'Löschen', destructive: true, onPress: () => confirmAction('Beitrag löschen?', 'Das kann nicht rückgängig gemacht werden.', 'Löschen',
      () => del.mutate(post.id, { onSuccess: () => { if (detail) router.back() } })) },
  ] : [
    { label: 'Per Nachricht senden', onPress: () => router.push(`/teilen/${post.id}`) },
    { label: 'Teilen über …', onPress: share },
    { label: `${post.author_name} schreiben`, onPress: contact },
    { label: 'Beitrag melden', destructive: true, onPress: () => reportFlow(me, { postId: post.id }) },
  ])
  const open = () => { if (!detail) router.push(`/post/${post.id}`) }

  const likes = post.like_count === 0 ? 'Sei die erste Person, der das gefällt' : post.like_count === 1 ? 'Gefällt 1 Mal' : `Gefällt ${post.like_count} Mal`

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Link href={`/profil/${post.author_id}`} asChild>
          <Pressable style={st.author}>
            <Avatar name={post.author_name} url={post.author_avatar_url} type={post.author_type} size={38} />
            <View style={{ flex: 1 }}>
              <View style={st.nameRow}>
                <Text style={st.name} numberOfLines={1}>{post.author_name}</Text>
                {post.author_verified && <Verified />}
              </View>
              {post.venue_name ? (
                <Text style={st.meta} numberOfLines={1}><Ionicons name="location" size={11} color={colors.accent} /> {post.venue_name}, {post.venue_city}</Text>
              ) : (
                <Text style={st.meta} numberOfLines={1}>{subtitle({ account_type: post.author_type, headline: post.author_headline })}</Text>
              )}
              {post.music && <MusicLine track={post.music} />}
            </View>
          </Pressable>
        </Link>
        <Pressable onPress={menu} hitSlop={12} accessibilityLabel="Optionen" style={{ padding: 4 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {post.video_url ? (detail ? <ReelPlayer post={post} /> : <ReelPreview post={post} onDoubleTap={likeOnce} />)
        : post.media.length > 0 ? <MediaCarousel media={post.media} onDoubleTap={likeOnce} /> : null}

      {!hasMedia && (
        <Pressable onPress={open} disabled={detail} style={st.textBlock}>
          {post.kind !== 'beitrag' && <Badge label={kind.label} icon={kind.icon as IconName} color={KIND_COLORS[post.kind]} />}
          {post.title && <Text style={st.title}>{post.title}</Text>}
          <RichText text={post.body} style={st.bodyLarge} numberOfLines={detail ? undefined : 8} />
        </Pressable>
      )}

      <View style={st.actions}>
        <Pressable onPress={() => like.mutate(post)} hitSlop={8} accessibilityLabel={post.liked_by_me ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}>
          <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={27} color={post.liked_by_me ? colors.heart : colors.text} />
        </Pressable>
        <Pressable onPress={open} hitSlop={8} accessibilityLabel="Kommentieren">
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push(`/teilen/${post.id}`)} hitSlop={8} accessibilityLabel="Senden an">
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => save.mutate(post)} hitSlop={8} style={{ marginLeft: 'auto' }} accessibilityLabel={post.saved_by_me ? 'Nicht mehr speichern' : 'Speichern'}>
          <Ionicons name={post.saved_by_me ? 'bookmark' : 'bookmark-outline'} size={24} color={post.saved_by_me ? colors.accent : colors.text} />
        </Pressable>
      </View>

      <View style={st.footer}>
        <Text style={st.likes}>{likes}</Text>
        {hasMedia && (
          <View style={{ gap: 6 }}>
            {(post.kind !== 'beitrag' || post.title) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {post.kind !== 'beitrag' && <Badge label={kind.label} icon={kind.icon as IconName} color={KIND_COLORS[post.kind]} />}
                {post.title && <Text style={st.titleSmall}>{post.title}</Text>}
              </View>
            )}
            <Pressable onPress={open} disabled={detail}>
              <RichText text={post.body} style={st.body} numberOfLines={detail ? undefined : 3} prefix={<Text style={{ fontWeight: '700' }}>{post.author_name.split(' ')[0]} </Text>} />
            </Pressable>
          </View>
        )}

        {post.link_url && (
          <Pressable style={st.link} onPress={() => Linking.openURL(post.link_url!)}>
            <Ionicons name="link" size={14} color={colors.muted} />
            <Text style={st.linkText} numberOfLines={1}>{post.link_url.replace(/^https?:\/\//, '')}</Text>
          </Pressable>
        )}

        {!mine && CTA[post.kind] && (
          <Pressable style={st.cta} onPress={contact} disabled={startChat.isPending} accessibilityRole="button">
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.onAccent} />
            <Text style={st.ctaText}>{CTA[post.kind]}</Text>
          </Pressable>
        )}

        {!detail && post.comment_count > 0 && (
          <Pressable onPress={open}><Text style={st.comments}>{post.comment_count === 1 ? '1 Kommentar ansehen' : `Alle ${post.comment_count} Kommentare ansehen`}</Text></Pressable>
        )}
        <Text style={st.time}>{timeAgo(post.created_at)}</Text>
      </View>
    </View>
  )
}

export default memo(PostCard)

const st = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 1 },
  textBlock: { paddingHorizontal: 14, paddingBottom: 6, gap: 8 },
  title: { color: colors.text, fontFamily: fonts.serif, fontSize: 21, fontWeight: '700', lineHeight: 27 },
  titleSmall: { color: colors.text, fontFamily: fonts.serif, fontSize: 17, fontWeight: '700' },
  bodyLarge: { color: colors.text, fontSize: 16, lineHeight: 23, opacity: 0.94 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 14, paddingTop: 10 },
  footer: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, gap: 6 },
  likes: { color: colors.text, fontWeight: '700', fontSize: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, padding: 10, borderRadius: radius.sm, marginTop: 2 },
  linkText: { color: colors.muted, fontSize: 13, flex: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: radius.md, backgroundColor: colors.accent, marginTop: 4 },
  ctaText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  comments: { color: colors.muted, fontSize: 14 },
  time: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
})
