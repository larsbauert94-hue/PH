import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import * as ExpoLinking from 'expo-linking'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFeed, useToggleLike, useToggleSave } from '../../lib/queries'
import { colors } from '../../lib/theme'
import type { FeedPost } from '../../lib/types'
import { Avatar, Empty, Loading, Verified } from '../../components/ui'
import { DoubleTap, RichText } from '../../components/media'

type ViewToken = { index?: number | null; isViewable?: boolean }

export default function Reels() {
  const { start } = useLocalSearchParams<{ start?: string }>()
  const insets = useSafeAreaInsets()
  const reels = useFeed({ reels: true })
  const [height, setHeight] = useState(0)
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(true)
  const [muted, setMuted] = useState(false)
  const list = useRef<FlatList<FeedPost>>(null)

  // Nur abspielen, solange der Tab sichtbar ist
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  // Zu einem bestimmten Reel springen (z. B. aus dem Feed geöffnet): Liste startet dort neu
  const startIndex = Math.max(0, start ? reels.posts.findIndex(p => p.id === start) : 0)
  const [seenStart, setSeenStart] = useState<string | undefined>(undefined)
  if (start !== seenStart && reels.posts.length) { setSeenStart(start); setActive(startIndex) }

  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(v => v.isViewable)
    if (first?.index != null) setActive(first.index)
  })

  return (
    <View style={st.root} onLayout={e => setHeight(e.nativeEvent.layout.height)}>
      {reels.isPending || !height ? <Loading /> : !reels.posts.length ? (
        <Empty icon="film-outline" text="Noch keine Reels. Teile das erste über „Posten“ → Reel." />
      ) : (
        <FlatList
          ref={list}
          key={start ?? 'alle'}
          initialScrollIndex={startIndex}
          data={reels.posts}
          keyExtractor={p => p.id}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_d, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onEndReached={reels.loadMore}
          windowSize={3}
          renderItem={({ item, index }) => (
            <Reel post={item} height={height} playing={focused && index === active} muted={muted} onToggleMute={() => setMuted(m => !m)} />
          )}
        />
      )}
      <View style={[st.header, { top: insets.top + 8 }]} pointerEvents="none">
        <Text style={st.headerText}>Reels</Text>
      </View>
    </View>
  )
}

const Reel = memo(function Reel({ post, height, playing, muted, onToggleMute }: { post: FeedPost; height: number; playing: boolean; muted: boolean; onToggleMute: () => void }) {
  const like = useToggleLike()
  const save = useToggleSave()
  const player = useVideoPlayer(post.video_url, p => { p.loop = true })
  const [showMute, setShowMute] = useState(false)

  // expo-video wird über Eigenschaften am Player gesteuert
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { player.muted = muted }, [player, muted])
  useEffect(() => {
    if (playing) player.play()
    // eslint-disable-next-line react-hooks/immutability
    else { player.pause(); player.currentTime = 0 }
  }, [player, playing])

  const toggleMute = () => {
    onToggleMute()
    setShowMute(true)
    setTimeout(() => setShowMute(false), 700)
  }
  const share = () => Share.share({ message: `${post.body}\n\n– ${post.author_name} auf Pour\n${ExpoLinking.createURL(`/post/${post.id}`)}` }).catch(() => {})

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {post.media[0] && <Image source={{ uri: post.media[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <DoubleTap onDoubleTap={() => { if (!post.liked_by_me) like.mutate(post) }} onTap={toggleMute}>
        <View style={{ height }} />
      </DoubleTap>
      {showMute && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <View style={st.muteBubble}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={30} color="#fff" /></View>
        </View>
      )}

      <View style={st.side}>
        <SideButton icon={post.liked_by_me ? 'heart' : 'heart-outline'} color={post.liked_by_me ? colors.heart : '#fff'} label={String(post.like_count)} onPress={() => like.mutate(post)} a11y="Gefällt mir" />
        <SideButton icon="chatbubble-outline" label={String(post.comment_count)} onPress={() => router.push(`/post/${post.id}`)} a11y="Kommentare" />
        <SideButton icon="paper-plane-outline" label="Teilen" onPress={share} a11y="Teilen" />
        <SideButton icon={post.saved_by_me ? 'bookmark' : 'bookmark-outline'} color={post.saved_by_me ? colors.accent : '#fff'} label="" onPress={() => save.mutate(post)} a11y="Speichern" />
      </View>

      <View style={st.info} pointerEvents="box-none">
        <Pressable style={st.author} onPress={() => router.push(`/profil/${post.author_id}`)}>
          <Avatar name={post.author_name} url={post.author_avatar_url} type={post.author_type} size={34} />
          <Text style={st.name}>{post.author_name}</Text>
          {post.author_verified && <Verified />}
        </Pressable>
        {post.title && <Text style={st.title}>{post.title}</Text>}
        <RichText text={post.body} style={st.caption} numberOfLines={3} />
        {post.venue_name && <Text style={st.venue}><Ionicons name="location" size={12} color="#fff" /> {post.venue_name}, {post.venue_city}</Text>}
      </View>
    </View>
  )
})

function SideButton({ icon, label, onPress, color = '#fff', a11y }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color?: string; a11y: string }) {
  return (
    <Pressable onPress={onPress} style={st.sideBtn} hitSlop={6} accessibilityLabel={a11y}>
      <Ionicons name={icon} size={30} color={color} style={st.shadow} />
      {label ? <Text style={st.sideLabel}>{label}</Text> : null}
    </Pressable>
  )
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8 }
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', left: 16 },
  headerText: { color: '#fff', fontSize: 22, fontWeight: '800', ...shadow },
  shadow,
  muteBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  side: { position: 'absolute', right: 10, bottom: 28, alignItems: 'center', gap: 20 },
  sideBtn: { alignItems: 'center', gap: 3 },
  sideLabel: { color: '#fff', fontSize: 12, fontWeight: '600', ...shadow },
  info: { position: 'absolute', left: 14, right: 80, bottom: 24, gap: 6 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  name: { color: '#fff', fontWeight: '700', fontSize: 15, ...shadow },
  title: { color: '#fff', fontWeight: '700', fontSize: 16, ...shadow },
  caption: { color: '#fff', fontSize: 14, lineHeight: 20, ...shadow },
  venue: { color: '#fff', fontSize: 13, opacity: 0.9, ...shadow },
})
