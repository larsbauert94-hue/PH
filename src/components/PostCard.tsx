import { memo } from 'react'
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import * as ExpoLinking from 'expo-linking'
import { Link, router } from 'expo-router'
import { Icon } from './Icon'
import type { FeedPost } from '../lib/types'
import { POST_KINDS, subtitle, timeAgo , ACCOUNT_TYPES } from '../lib/labels'
import { colors, fonts, radius } from '../lib/theme'
import { useMe } from '../lib/auth'
import { api } from '../lib/api'
import { useDeletePost, usePromote, useStartConversation, useToggleLike, useToggleSave } from '../lib/queries'
import { CheckinBlock, RecipeBlock, TemplateCard } from './checkin'
import { tap } from './motion'
import { chooseAction, confirmAction, notify, reportFlow } from './report'
import { MediaCarousel, ReelPlayer, ReelPreview, RichText } from './media'
import { MusicLine } from './music'
import { Avatar, Badge, IconName, Verified } from './ui'

const KIND_COLORS = { beitrag: colors.muted, neuheit: colors.accent, angebot: '#7cc47f', event: colors.lavender, job: colors.heart, checkin: colors.accentLight, rezept: '#e8c36a' }
const CTA: Partial<Record<FeedPost['kind'], string>> = { job: 'Jetzt bewerben', angebot: 'Angebot anfragen', neuheit: 'Mehr erfahren' }

function PostCard({ post, detail = false }: { post: FeedPost; detail?: boolean }) {
  const { me, profile } = useMe()
  const promote = usePromote()
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
  // Bewerben mit einem Tipp: Nachricht mit Kurz-Lebenslauf an den Betrieb
  const apply = () => confirmAction('Bewerbung senden?', `${post.author_name} bekommt eine Nachricht mit deinem Lebenslauf aus dem Profil.`, 'Bewerbung senden', () => {
    const cv = [
      `Hallo, ich möchte mich auf „${post.title ?? 'eure Stelle'}“ bewerben.`,
      profile.headline || profile.workplace ? `Aktuell: ${[profile.headline, profile.workplace].filter(Boolean).join(' @ ')}` : '',
      profile.stations?.length ? `Stationen: ${profile.stations.join('; ')}` : '',
      profile.certificates?.length ? `Zertifikate: ${profile.certificates.join(', ')}` : '',
      profile.skills?.length ? `Stärken: ${profile.skills.join(', ')}` : '',
      profile.available_from ? `Verfügbar ab ${new Date(profile.available_from).toLocaleDateString('de-DE')}` : '',
      `Mein Profil: @${profile.handle}`,
    ].filter(Boolean).join('\n')
    startChat.mutate(post.author_id, {
      onSuccess: id => api.sendMessage(me, id, cv).then(() => router.push(`/chat/${id}`)).catch(e => notify('Nachricht', e.message)),
      onError: e => notify('Nachricht', e.message),
    })
  })
  const likeOnce = () => { if (!post.liked_by_me) like.mutate(post) }
  const toCollection = () => router.push({ pathname: '/sammlungen/hinzufuegen', params: { post: post.id } })
  const canPromote = mine && ACCOUNT_TYPES[profile.account_type].business
  const menu = () => chooseAction('Beitrag', mine ? [
    ...(canPromote ? [{ label: post.promoted ? 'Nicht mehr hervorheben' : 'Hervorheben (Pro)', onPress: () => promote.mutate({ id: post.id, promoted: !post.promoted }) }] : []),
    { label: 'Zu Sammlung hinzufügen', onPress: toCollection },
    { label: 'Teilen über …', onPress: share },
    { label: 'Löschen', destructive: true, onPress: () => confirmAction('Beitrag löschen?', 'Das kann nicht rückgängig gemacht werden.', 'Löschen',
      () => del.mutate(post.id, { onSuccess: () => { if (detail) router.back() } })) },
  ] : [
    { label: 'Per Nachricht senden', onPress: () => router.push(`/teilen/${post.id}`) },
    { label: 'Zu Sammlung hinzufügen', onPress: toCollection },
    { label: 'Teilen über …', onPress: share },
    { label: `${post.author_name} schreiben`, onPress: contact },
    { label: 'Beitrag melden', destructive: true, onPress: () => reportFlow(me, { postId: post.id }) },
  ])
  const open = () => { if (!detail) router.push(`/post/${post.id}`) }
  // Schnellaktionen per langem Drücken
  const quick = () => {
    tap('medium')
    chooseAction(post.author_name, [
      { label: post.saved_by_me ? 'Nicht mehr speichern' : 'Speichern', onPress: () => save.mutate(post) },
      { label: 'Zu Sammlung hinzufügen', onPress: toCollection },
      { label: 'Senden an …', onPress: () => router.push(`/teilen/${post.id}`) },
      ...(post.venue_id ? [{ label: `Ort öffnen: ${post.venue_name}`, onPress: () => router.push(`/ort/${post.venue_id}`) }] : []),
      { label: 'Profil ansehen', onPress: () => router.push(`/profil/${post.author_id}`) },
    ])
  }

  const likes = post.like_count === 0 ? 'Stoß als Erste:r an' : post.like_count === 1 ? '1 × angestoßen' : `${post.like_count} × angestoßen`

  return (
    <Pressable style={st.card} onLongPress={quick} delayLongPress={450} accessibilityHint="Lange drücken für Schnellaktionen">
      {(post.promoted || post.urgent || post.group_name || post.remix_of) && (
        <View style={st.ribbonRow}>
          {post.promoted && <Text style={st.ribbon}>✦ Hervorgehoben</Text>}
          {post.urgent && <Text style={[st.ribbon, { color: colors.heart }]}>● Dringend · heute</Text>}
          {post.group_name && <Text style={st.ribbon}>in {post.group_name}</Text>}
          {post.remix_of && (
            <Pressable onPress={() => router.push(`/post/${post.remix_of}`)}><Text style={st.ribbon}>↻ Nachgemixt · Original ansehen</Text></Pressable>
          )}
        </View>
      )}
      <View style={st.header}>
        <Link href={`/profil/${post.author_id}`} asChild>
          <Pressable style={st.author}>
            <Avatar name={post.author_name} url={post.author_avatar_url} type={post.author_type} size={38} />
            <View style={{ flex: 1 }}>
              <View style={st.nameRow}>
                <Text style={st.name} numberOfLines={1}>{post.author_name}</Text>
                {post.author_verified && <Verified />}
                {post.collab_name && (
                  <Text style={st.name} numberOfLines={1} onPress={() => router.push(`/u/${post.collab_handle}`)}>
                    <Text style={{ color: colors.accent }}> × </Text>{post.collab_name}
                  </Text>
                )}
              </View>
              {post.venue_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Icon name="location-outline" size={12} color={colors.accent} /><Text style={[st.meta, { flexShrink: 1 }]} numberOfLines={1}>{post.venue_name}, {post.venue_city}</Text></View>
              ) : (
                <Text style={st.meta} numberOfLines={1}>{subtitle({ account_type: post.author_type, headline: post.author_headline })}</Text>
              )}
              {post.music && <MusicLine track={post.music} />}
            </View>
          </Pressable>
        </Link>
        <Pressable onPress={menu} hitSlop={12} accessibilityLabel="Optionen" style={{ padding: 4 }}>
          <Icon name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {post.video_url ? (detail ? <ReelPlayer post={post} /> : <ReelPreview post={post} onDoubleTap={likeOnce} />)
        : post.media.length > 0 ? <MediaCarousel media={post.media} onDoubleTap={likeOnce} /> : null}

      {!hasMedia && post.template && (
        <Pressable onPress={open} disabled={detail}>
          <TemplateCard template={post.template} title={post.title} body={post.body} author={post.author_name} />
        </Pressable>
      )}

      <CheckinBlock post={post} />

      {!hasMedia && !post.template && (
        <Pressable onPress={open} disabled={detail} style={st.textBlock}>
          {post.kind !== 'beitrag' && <Badge label={kind.label} icon={kind.icon as IconName} color={KIND_COLORS[post.kind]} />}
          {post.title && <Text style={st.title}>{post.title}</Text>}
          <RichText text={post.body} style={st.bodyLarge} numberOfLines={detail ? undefined : 8} />
        </Pressable>
      )}

      {post.recipe && (hasMedia || !post.template) && <RecipeBlock recipe={post.recipe} full={detail} post={post} />}

      <View style={st.actions}>
        <Pressable onPress={() => { tap(); like.mutate(post) }} hitSlop={8} accessibilityLabel={post.liked_by_me ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}>
          <Icon name={post.liked_by_me ? 'cheers' : 'cheers-outline'} size={28} color={post.liked_by_me ? colors.accent : colors.text} />
        </Pressable>
        <Pressable onPress={open} hitSlop={8} accessibilityLabel="Kommentieren">
          <Icon name="chatbubble-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push(`/teilen/${post.id}`)} hitSlop={8} accessibilityLabel="Senden an">
          <Icon name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => save.mutate(post)} hitSlop={8} style={{ marginLeft: 'auto' }} accessibilityLabel={post.saved_by_me ? 'Nicht mehr speichern' : 'Speichern'}>
          <Icon name={post.saved_by_me ? 'bookmark' : 'bookmark-outline'} size={24} color={post.saved_by_me ? colors.accent : colors.text} />
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
            <Icon name="link" size={14} color={colors.muted} />
            <Text style={st.linkText} numberOfLines={1}>{post.link_url.replace(/^https?:\/\//, '')}</Text>
          </Pressable>
        )}

        {!mine && CTA[post.kind] && (
          <Pressable style={st.cta} onPress={post.kind === 'job' && !ACCOUNT_TYPES[profile.account_type].business ? apply : contact} disabled={startChat.isPending} accessibilityRole="button">
            <Icon name="chatbubble-ellipses-outline" size={18} color={colors.onAccent} />
            <Text style={st.ctaText}>{CTA[post.kind]}</Text>
          </Pressable>
        )}

        {!detail && post.comment_count > 0 && (
          <Pressable onPress={open}><Text style={st.comments}>{post.comment_count === 1 ? '1 Kommentar ansehen' : `Alle ${post.comment_count} Kommentare ansehen`}</Text></Pressable>
        )}
        <Text style={st.time}>{timeAgo(post.created_at)}</Text>
      </View>
    </Pressable>
  )
}

export default memo(PostCard)

const st = StyleSheet.create({
  // Randlos wie bei Instagram; nur ein feiner Roségold-Strich trennt die Beiträge
  card: { backgroundColor: 'transparent', paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(227,165,133,0.5)' },
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
  ribbonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14, paddingTop: 10, marginBottom: -4 },
  ribbon: { color: colors.accentLight, fontSize: 12, fontWeight: '700' },
  time: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
})
