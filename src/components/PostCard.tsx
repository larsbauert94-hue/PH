import { memo } from 'react'
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import * as ExpoLinking from 'expo-linking'
import { Image } from 'expo-image'
import { Link, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { FeedPost } from '../lib/types'
import { CATEGORIES, POST_KINDS, subtitle, timeAgo } from '../lib/labels'
import { colors, fonts, radius } from '../lib/theme'
import { useMe } from '../lib/auth'
import { useDeletePost, useStartConversation, useToggleLike } from '../lib/queries'
import { chooseAction, confirmAction, notify, reportFlow } from './report'
import { Avatar, Badge, IconName, Verified } from './ui'

const KIND_COLORS = { beitrag: colors.muted, neuheit: colors.accent, angebot: '#7cc47f', event: colors.lavender, job: colors.heart }

function PostCard({ post, detail = false }: { post: FeedPost; detail?: boolean }) {
  const { me } = useMe()
  const like = useToggleLike()
  const del = useDeletePost()
  const startChat = useStartConversation()
  const kind = POST_KINDS[post.kind]
  const mine = post.author_id === me

  const share = () => {
    const text = [post.title, post.body].filter(Boolean).join('\n\n')
    Share.share({ message: `${text}\n\n– ${post.author_name} auf Pour\n${ExpoLinking.createURL(`/post/${post.id}`)}` }).catch(() => {})
  }
  const contact = () => startChat.mutate(post.author_id, {
    onSuccess: id => router.push(`/chat/${id}`),
    onError: e => notify('Nachricht', e.message),
  })
  const menu = () => chooseAction('Beitrag', mine ? [
    { label: 'Teilen', onPress: share },
    { label: 'Löschen', destructive: true, onPress: () => confirmAction('Beitrag löschen?', 'Das kann nicht rückgängig gemacht werden.', 'Löschen',
      () => del.mutate(post.id, { onSuccess: () => { if (detail) router.back() } })) },
  ] : [
    { label: 'Teilen', onPress: share },
    { label: `${post.author_name} schreiben`, onPress: contact },
    { label: 'Beitrag melden', destructive: true, onPress: () => reportFlow(me, { postId: post.id }) },
  ])

  const open = () => !detail && router.push(`/post/${post.id}`)

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Link href={`/profil/${post.author_id}`} asChild>
          <Pressable style={st.author}>
            <Avatar name={post.author_name} url={post.author_avatar_url} type={post.author_type} size={42} />
            <View style={{ flex: 1 }}>
              <View style={st.nameRow}>
                <Text style={st.name} numberOfLines={1}>{post.author_name}</Text>
                {post.author_verified && <Verified />}
              </View>
              <Text style={st.meta} numberOfLines={1}>
                {subtitle({ account_type: post.author_type, headline: post.author_headline })} · {timeAgo(post.created_at)}
              </Text>
            </View>
          </Pressable>
        </Link>
        <Pressable onPress={menu} hitSlop={12} accessibilityLabel="Optionen">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.faint} />
        </Pressable>
      </View>

      <Pressable onPress={open} disabled={detail} style={{ gap: 8 }}>
        {post.kind !== 'beitrag' && <Badge label={kind.label} icon={kind.icon as IconName} color={KIND_COLORS[post.kind]} />}
        {post.title && <Text style={st.title}>{post.title}</Text>}
        <Text style={st.body} numberOfLines={detail ? undefined : 6}>{post.body}</Text>
      </Pressable>

      {post.image_url && (
        <Pressable onPress={open} disabled={detail}>
          <Image source={{ uri: post.image_url }} style={st.image} contentFit="cover" transition={150} />
        </Pressable>
      )}

      <View style={st.tags}>
        <Text style={st.tag}>#{CATEGORIES[post.category]}</Text>
        {post.venue_name && (
          <Link href={`/ort/${post.venue_id}`} asChild>
            <Pressable style={st.place}>
              <Ionicons name="location" size={13} color={colors.accent} />
              <Text style={st.placeText}>{post.venue_name}, {post.venue_city}</Text>
            </Pressable>
          </Link>
        )}
      </View>

      {post.link_url && (
        <Pressable style={st.link} onPress={() => Linking.openURL(post.link_url!)}>
          <Ionicons name="link" size={14} color={colors.muted} />
          <Text style={st.linkText} numberOfLines={1}>{post.link_url.replace(/^https?:\/\//, '')}</Text>
        </Pressable>
      )}

      {!mine && (post.kind === 'job' || post.kind === 'angebot' || post.kind === 'neuheit') && (
        <Pressable style={st.cta} onPress={contact} disabled={startChat.isPending} accessibilityRole="button">
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.onAccent} />
          <Text style={st.ctaText}>{post.kind === 'job' ? 'Jetzt bewerben' : post.kind === 'angebot' ? 'Angebot anfragen' : 'Mehr erfahren'}</Text>
        </Pressable>
      )}

      <View style={st.actions}>
        <Pressable onPress={() => like.mutate(post)} style={st.action} hitSlop={8} accessibilityLabel={post.liked_by_me ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}>
          <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={22} color={post.liked_by_me ? colors.heart : colors.muted} />
          <Text style={st.count}>{post.like_count}</Text>
        </Pressable>
        <Pressable onPress={open} style={st.action} hitSlop={8} accessibilityLabel="Kommentare">
          <Ionicons name="chatbubble-outline" size={20} color={colors.muted} />
          <Text style={st.count}>{post.comment_count}</Text>
        </Pressable>
        <Pressable onPress={share} style={[st.action, { marginLeft: 'auto' }]} hitSlop={8} accessibilityLabel="Teilen">
          <Ionicons name="paper-plane-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  )
}

export default memo(PostCard)

const st = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  title: { color: colors.text, fontFamily: fonts.serif, fontSize: 20, fontWeight: '700', lineHeight: 26 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22, opacity: 0.92 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surface2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  tag: { color: colors.accentLight, fontSize: 13, fontWeight: '500' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeText: { color: colors.muted, fontSize: 13 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, padding: 10, borderRadius: radius.sm },
  linkText: { color: colors.muted, fontSize: 13, flex: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: radius.md, backgroundColor: colors.accent },
  ctaText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 22, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  count: { color: colors.muted, fontSize: 14 },
})
