import { useEffect, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { router } from 'expo-router'
import { Icon } from './Icon'
import { useMe } from '../lib/auth'
import { useBlock, useFeed, useFollow, useProfile, useProfileStats, useSavedVenues, useStartConversation, useStories, useUploadAvatar, useVenues } from '../lib/queries'
import { api } from '../lib/api'
import { BadgeShelf } from './Badges'
import { VenueCard } from './VenueCard'
import { pickImage } from '../lib/pickImage'
import { ACCOUNT_TYPES, subtitle } from '../lib/labels'
import { colors, fonts } from '../lib/theme'
import PostCard from './PostCard'
import { PostGrid } from './media'
import { StoryRing } from './StoryBar'
import Highlights from './Highlights'
import { Badge, Button, Empty, ErrorView, IconName, Loading, Verified } from './ui'
import { chooseAction, confirmAction, notify, reportFlow } from './report'

type Tab = 'grid' | 'reels' | 'checkins' | 'list' | 'saved'

export default function ProfileView({ id, onEdit }: { id: string; onEdit?: () => void }) {
  const { me } = useMe()
  const profile = useProfile(id)
  const stats = useProfileStats(id)
  const follow = useFollow(id)
  const block = useBlock(id)
  const startChat = useStartConversation()
  const avatar = useUploadAvatar()
  const stories = useStories()
  const savedVenues = useSavedVenues()
  const isMe = id === me
  const [tab, setTab] = useState<Tab>('grid')
  const posts = useFeed(tab === 'saved' ? { saved: true } : tab === 'reels' ? { authorId: id, reels: true } : tab === 'checkins' ? { authorId: id, tab: 'checkins' } : { authorId: id })
  const venues = useVenues()
  // Profilaufrufe zählen (Statistik für Betriebe)
  useEffect(() => { if (me && id !== me) api.recordProfileView(me, id).catch(() => {}) }, [me, id])

  if (profile.isPending) return <Loading />
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />
  const p = profile.data
  if (!p) return <Empty icon="person-outline" text="Dieses Profil gibt es nicht mehr." />

  const type = ACCOUNT_TYPES[p.account_type]
  const ownVenue = venues.data?.find(v => v.owner_id === id)
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
    { key: 'checkins', icon: 'cheers', label: 'Trinktagebuch' },
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
            {isMe && !storyGroup && <View style={st.camera}><Icon name="camera" size={14} color={colors.onAccent} /></View>}
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
            {p.city ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="location-outline" size={14} color={colors.muted} /><Text style={st.meta}>{p.city}</Text></View> : null}
          </View>
          {!type.business && (p.headline || p.workplace) ? <Text style={st.job}>{subtitle(p)}</Text> : null}
          {p.bio ? <Text style={st.bio}>{p.bio}</Text> : null}
          {p.website ? (
            <Pressable onPress={() => Linking.openURL(p.website!)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="link" size={14} color={colors.accentLight} /><Text style={st.web}>{p.website.replace(/^https?:\/\//, '')}</Text></View>
            </Pressable>
          ) : null}
        </View>

        {type.business && ownVenue && <VenueCard venue={ownVenue} />}
        {!type.business && <CV p={p} isMe={isMe} />}

        {isMe ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {onEdit && <Button title="Profil bearbeiten" variant="secondary" style={st.smallBtn} onPress={onEdit} />}
              <Button title="Story hinzufügen" variant="secondary" style={st.smallBtn} onPress={() => router.push('/story/neu')} />
            </View>
            {type.business && <Button title="Statistiken · Pour Pro" icon="stats-chart-outline" variant="secondary" style={st.smallBtn} onPress={() => router.push('/statistik')} />}
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
              <Icon name="ellipsis-horizontal" size={20} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>

      {!blocked && <Highlights ownerId={id} isMe={isMe} />}
      {!blocked && !type.business && <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}><BadgeShelf userId={id} /></View>}

      {!blocked && (
        <View style={st.tabs}>
          {tabs.map(t => (
            <Pressable key={t.key} style={[st.tab, tab === t.key && st.tabActive]} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.key }}>
              <Icon name={tab === t.key ? t.icon : (`${t.icon}-outline` as IconName)} size={22} color={tab === t.key ? colors.text : colors.faint} />
            </Pressable>
          ))}
        </View>
      )}

      {tab === 'saved' && (
        <Pressable style={st.collections} onPress={() => router.push('/sammlungen')} accessibilityRole="button">
          <Icon name="albums-outline" size={20} color={colors.accent} />
          <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>Sammlungen, auch gemeinsam mit Freunden</Text>
          <Icon name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      )}
      {tab === 'saved' && !!savedVenues.data?.length && (
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <Text style={st.savedTitle}>Gemerkte Orte</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {savedVenues.data.map(v => (
              <Pressable key={v.id} style={st.placeChip} onPress={() => router.push(`/ort/${v.id}`)}>
                <Icon name="location" size={14} color={colors.accent} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>{v.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {blocked ? <Empty icon="ban-outline" text="Du hast dieses Profil blockiert." />
        : posts.isPending ? <Loading />
        : !posts.posts.length ? (
          <Empty
            icon={tab === 'saved' ? 'bookmark-outline' : tab === 'reels' ? 'film-outline' : tab === 'checkins' ? 'cheers-outline' : 'camera-outline'}
            text={tab === 'saved' ? 'Tippe bei Beiträgen auf das Lesezeichen, um sie hier zu sammeln.' : tab === 'reels' ? 'Noch keine Reels.' : tab === 'checkins' ? 'Noch keine Check-ins im Trinktagebuch.' : isMe ? 'Teile deinen ersten Beitrag über „Posten“.' : 'Noch keine Beiträge.'}
          />
        ) : tab === 'list' || tab === 'checkins' ? (
          <View style={{ padding: 12, gap: 14 }}>{posts.posts.map(x => <PostCard key={x.id} post={x} />)}</View>
        ) : <PostGrid posts={posts.posts} />}
    </ScrollView>
  )
}

/** Lebenslauf für Gastro-Profis: Stationen, Zertifikate, Fähigkeiten */
function CV({ p, isMe }: { p: NonNullable<ReturnType<typeof useProfile>['data']>; isMe: boolean }) {
  const has = !!(p.stations?.length || p.certificates?.length || p.skills?.length || p.open_to_work)
  if (!has && !isMe) return null
  return (
    <View style={st.cv}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={st.cvTitle}>Lebenslauf</Text>
        {p.open_to_work && <Text style={st.open}>● Offen für Jobs{p.available_from ? ` ab ${new Date(p.available_from).toLocaleDateString('de-DE')}` : ''}</Text>}
        {isMe && <Pressable onPress={() => router.push('/lebenslauf')} hitSlop={8} style={{ marginLeft: 'auto' }} accessibilityLabel="Lebenslauf bearbeiten"><Text style={st.cvEdit}>Bearbeiten</Text></Pressable>}
      </View>
      {!has && <Text style={st.meta}>Zeig Betrieben deine Stationen, Zertifikate und Stärken. Bewerben geht dann mit einem Tipp.</Text>}
      {p.stations?.map(x => <Text key={x} style={st.cvLine}>• {x}</Text>)}
      {!!p.certificates?.length && <Text style={st.cvLine}><Text style={{ color: colors.muted }}>Zertifikate: </Text>{p.certificates.join(' · ')}</Text>}
      {!!p.skills?.length && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {p.skills.map(x => <Text key={x} style={st.skill}>{x}</Text>)}
        </View>
      )}
    </View>
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
  savedTitle: { color: colors.text, fontWeight: '700', paddingHorizontal: 16 },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  cv: { gap: 6, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cvTitle: { color: colors.text, fontWeight: '700' },
  cvEdit: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  cvLine: { color: colors.text, fontSize: 13, lineHeight: 19 },
  open: { color: '#6cc596', fontSize: 12, fontWeight: '700' },
  skill: { color: colors.accentLight, fontSize: 12, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(227,165,133,0.1)' },
  collections: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, marginBottom: 0, padding: 12, borderRadius: 14, backgroundColor: colors.surface },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },
})
