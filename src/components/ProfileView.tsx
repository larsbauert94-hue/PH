import { useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '../lib/auth'
import { useBlock, useFeed, useFollow, useProfile, useProfileStats, useStartConversation, useStories, useUploadAvatar } from '../lib/queries'
import { pickImage } from '../lib/pickImage'
import { ACCOUNT_TYPES, subtitle } from '../lib/labels'
import { colors, fonts } from '../lib/theme'
import PostCard from './PostCard'
import { PostGrid } from './media'
import { StoryRing } from './StoryBar'
import { Badge, Button, Empty, ErrorView, IconName, Loading, Verified } from './ui'
import { chooseAction, confirmAction, notify, reportFlow } from './report'

type Tab = 'grid' | 'reels' | 'list' | 'saved'

export default function ProfileView({ id, onEdit }: { id: string; onEdit?: () => void }) {
  const { me } = useMe()
  const profile = useProfile(id)
  const stats = useProfileStats(id)
  const follow = useFollow(id)
  const block = useBlock(id)
  const startChat = useStartConversation()
  const avatar = useUploadAvatar()
  const stories = useStories()
  const isMe = id === me
  const [tab, setTab] = useState<Tab>('grid')
  const posts = useFeed(tab === 'saved' ? { saved: true } : tab === 'reels' ? { authorId: id, reels: true } : { authorId: id })

  if (profile.isPending) return <Loading />
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />
  const p = profile.data
  if (!p) return <Empty icon="person-outline" text="Dieses Profil gibt es nicht mehr." />

  const type = ACCOUNT_TYPES[p.account_type]
  const blocked = stats.data?.blocked_by_me
  const storyGroup = stories.data?.find(g => g.author_id === id)

  const toggleBlock = () => {
    if (blocked) { block.mutate(false); return }
    confirmAction(`${p.name} blockieren?`, 'Ihr seht gegenseitig keine Beiträge, Storys und Kommentare mehr, folgt euch nicht mehr und könnt euch nicht mehr schreiben.', 'Blockieren', () => block.mutate(true))
  }
  const more = () => chooseAction(p.name, [
    { label: 'Profil melden', onPress: () => reportFlow(me, { profileId: id }) },
    { label: 'Blockieren', destructive: true, onPress: toggleBlock },
  ])
  const message = () => startChat.mutate(id, {
    onSuccess: convId => router.push(`/chat/${convId}`),
    onError: e => notify('Nachricht', e.message),
  })
  const changePhoto = () => chooseAction('Profilbild', [
    { label: 'Aus Fotos wählen', onPress: async () => { const img = await pickImage({ square: true }); if (img) avatar.mutate(img) } },
    { label: 'Foto aufnehmen', onPress: async () => { const img = await pickImage({ square: true, camera: true }); if (img) avatar.mutate(img) } },
  ])
  const avatarPress = () => storyGroup ? router.push(`/story/${id}`) : isMe ? changePhoto() : undefined

  const tabs: { key: Tab; icon: IconName; label: string }[] = [
    { key: 'grid', icon: 'grid', label: 'Beiträge' },
    { key: 'reels', icon: 'film', label: 'Reels' },
    { key: 'list', icon: 'reorder-four', label: 'Liste' },
    ...(isMe ? [{ key: 'saved' as const, icon: 'bookmark' as IconName, label: 'Gespeichert' }] : []),
  ]

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y > contentSize.height - 400) posts.loadMore()
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 32 }}
      onScroll={onScroll}
      scrollEventThrottle={200}
      refreshControl={<RefreshControl refreshing={posts.isRefetching} onRefresh={() => { posts.refetch(); stats.refetch(); profile.refetch() }} tintColor={colors.accent} />}
    >
      <View style={st.header}>
        <View style={st.top}>
          <Pressable onPress={avatarPress} disabled={!storyGroup && !isMe} accessibilityLabel={storyGroup ? 'Story ansehen' : isMe ? 'Profilbild ändern' : undefined}>
            <StoryRing name={p.name} url={p.avatar_url} type={p.account_type} size={92} active={!!storyGroup} seen={storyGroup?.all_seen} />
            {isMe && !storyGroup && <View style={st.camera}><Ionicons name="camera" size={14} color={colors.onAccent} /></View>}
          </Pressable>
          <View style={st.stats}>
            <Stat n={stats.data?.post_count} label="Beiträge" />
            <Stat n={stats.data?.follower_count} label="Follower" />
            <Stat n={stats.data?.following_count} label="Folgt" />
          </View>
        </View>
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={st.name}>{p.name}</Text>
            {p.verified && <Verified size={18} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge label={type.label} icon={type.icon as IconName} />
            {p.city ? <Text style={st.meta}><Ionicons name="location-outline" size={13} /> {p.city}</Text> : null}
          </View>
          {!type.business && (p.headline || p.workplace) ? <Text style={st.job}>{subtitle(p)}</Text> : null}
          {p.bio ? <Text style={st.bio}>{p.bio}</Text> : null}
          {p.website ? (
            <Pressable onPress={() => Linking.openURL(p.website!)}>
              <Text style={st.web}><Ionicons name="link" size={13} /> {p.website.replace(/^https?:\/\//, '')}</Text>
            </Pressable>
          ) : null}
        </View>

        {isMe ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onEdit && <Button title="Profil bearbeiten" variant="secondary" style={st.smallBtn} onPress={onEdit} />}
            <Button title="Story hinzufügen" variant="secondary" style={st.smallBtn} onPress={() => router.push('/story/neu')} />
          </View>
        ) : blocked ? (
          <Button title="Blockierung aufheben" variant="secondary" onPress={toggleBlock} loading={block.isPending} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title={stats.data?.followed_by_me ? 'Gefolgt' : 'Folgen'}
              variant={stats.data?.followed_by_me ? 'secondary' : 'primary'}
              style={st.smallBtn}
              loading={follow.isPending}
              onPress={() => follow.mutate(!stats.data?.followed_by_me)}
            />
            <Button title="Nachricht" variant="secondary" style={st.smallBtn} loading={startChat.isPending} onPress={message} />
            <Pressable style={st.iconBtn} onPress={more} accessibilityLabel="Weitere Optionen">
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>

      {!blocked && (
        <View style={st.tabs}>
          {tabs.map(t => (
            <Pressable key={t.key} style={[st.tab, tab === t.key && st.tabActive]} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.key }}>
              <Ionicons name={tab === t.key ? t.icon : (`${t.icon}-outline` as IconName)} size={22} color={tab === t.key ? colors.text : colors.faint} />
            </Pressable>
          ))}
        </View>
      )}

      {blocked ? <Empty icon="ban-outline" text="Du hast dieses Profil blockiert." />
        : posts.isPending ? <Loading />
        : !posts.posts.length ? (
          <Empty
            icon={tab === 'saved' ? 'bookmark-outline' : tab === 'reels' ? 'film-outline' : 'camera-outline'}
            text={tab === 'saved' ? 'Tippe bei Beiträgen auf das Lesezeichen, um sie hier zu sammeln.' : tab === 'reels' ? 'Noch keine Reels.' : isMe ? 'Teile deinen ersten Beitrag über „Posten“.' : 'Noch keine Beiträge.'}
          />
        ) : tab === 'list' ? (
          <View style={{ padding: 12, gap: 14 }}>{posts.posts.map(x => <PostCard key={x.id} post={x} />)}</View>
        ) : <PostGrid posts={posts.posts} />}
    </ScrollView>
  )
}

function Stat({ n, label }: { n?: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={st.statN}>{n ?? '–'}</Text>
      <Text style={st.statL}>{label}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  header: { gap: 14, padding: 16, paddingBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stats: { flex: 1, flexDirection: 'row' },
  statN: { color: colors.text, fontSize: 19, fontWeight: '700' },
  statL: { color: colors.muted, fontSize: 12, marginTop: 2 },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 22, fontWeight: '700', flexShrink: 1 },
  job: { color: colors.text, fontSize: 14, fontWeight: '500' },
  meta: { color: colors.muted, fontSize: 13 },
  bio: { color: colors.text, fontSize: 14, lineHeight: 20, opacity: 0.92 },
  web: { color: colors.accentLight, fontSize: 14, fontWeight: '600' },
  smallBtn: { flex: 1, height: 38, borderRadius: 10 },
  iconBtn: { width: 42, height: 38, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  camera: { position: 'absolute', right: 2, bottom: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },
})
