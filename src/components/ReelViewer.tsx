import { memo, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Icon } from '../components/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToggleLike, useToggleSave } from '../lib/queries'
import { colors, fonts } from '../lib/theme'
import type { FeedPost } from '../lib/types'
import { Avatar, Empty, Loading, Verified, type IconName } from '../components/ui'
import { DoubleTap, RichText } from '../components/media'
import { MusicLine } from '../components/music'

type ViewToken = { index?: number | null; isViewable?: boolean }

/**
 * Reels zum Hoch- und Runterwischen. Im Reels-Tab mit Leiste unten (Tipp öffnet Vollbild),
 * im Vollbild ohne Leiste (Tipp schaltet den Ton).
 */
export default function ReelViewer({ posts, startId, onEndReached, onClose, onOpen, paused = false, title }: {
  posts: FeedPost[]; startId?: string; onEndReached?: () => void
  /** Schließen-Knopf (nur im Vollbild) */ onClose?: () => void
  /** Einfacher Tipp aufs Video, z. B. Vollbild öffnen */ onOpen?: (post: FeedPost) => void
  paused?: boolean; title?: string
}) {
  const insets = useSafeAreaInsets()
  const [height, setHeight] = useState(0)
  const startIndex = Math.max(0, startId ? posts.findIndex(p => p.id === startId) : 0)
  const [active, setActive] = useState(startIndex)
  const [muted, setMuted] = useState(false)
  const list = useRef<FlatList<FeedPost>>(null)
  // Zeitpunkt der letzten Scroll-Bewegung: Tipps kurz danach sind keine Tipps, sondern Wischen
  const lastScroll = useRef(0)

  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(v => v.isViewable)
    if (first?.index != null) setActive(first.index)
  })

  return (
    <View style={st.root} onLayout={e => setHeight(e.nativeEvent.layout.height)}>
      {!height ? <Loading /> : !posts.length ? (
        <Empty icon="film-outline" text="Dieses Reel gibt es nicht mehr." />
      ) : (
        <FlatList
          ref={list}
          initialScrollIndex={startIndex}
          data={posts}
          keyExtractor={p => p.id}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_d, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onEndReached={onEndReached}
          onScroll={() => { lastScroll.current = Date.now() }}
          onScrollBeginDrag={() => { lastScroll.current = Date.now() }}
          onMomentumScrollEnd={() => { lastScroll.current = Date.now() }}
          scrollEventThrottle={32}
          windowSize={3}
          renderItem={({ item, index }) => (
            <Reel post={item} height={height} playing={!paused && index === active} muted={muted} onToggleMute={() => setMuted(m => !m)} onTap={onOpen ? () => { if (Date.now() - lastScroll.current > 600) onOpen(item) } : undefined} />
          )}
        />
      )}
      {title && (
        <View style={[st.titleBox, { top: insets.top + 10 }]} pointerEvents="none">
          <Text style={st.screenTitle}>{title}</Text>
        </View>
      )}
      {onOpen && (
        <Pressable onPress={() => setMuted(m => !m)} style={[st.mute, { top: insets.top + 8 }]} hitSlop={10} accessibilityRole="button" accessibilityLabel={muted ? 'Ton an' : 'Ton aus'}>
          <Icon name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
        </Pressable>
      )}
      {onClose && (
        <Pressable onPress={onClose} style={[st.close, { top: insets.top + 8 }]} hitSlop={10} accessibilityRole="button" accessibilityLabel="Vollbild schließen">
          <Icon name="chevron-down" size={26} color="#fff" />
        </Pressable>
      )}
    </View>
  )
}

const Reel = memo(function Reel({ post, height, playing, muted, onToggleMute, onTap }: { post: FeedPost; height: number; playing: boolean; muted: boolean; onToggleMute: () => void; onTap?: () => void }) {
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

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {post.media[0] && <Image source={{ uri: post.media[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <DoubleTap onDoubleTap={() => { if (!post.liked_by_me) like.mutate(post) }} onTap={onTap ?? toggleMute}>
        <View style={{ height }} />
      </DoubleTap>
      {showMute && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <View style={st.muteBubble}><Icon name={muted ? 'volume-mute' : 'volume-high'} size={30} color="#fff" /></View>
        </View>
      )}

      <View style={st.side}>
        <SideButton icon={post.liked_by_me ? 'heart' : 'heart-outline'} color={post.liked_by_me ? colors.heart : '#fff'} label={String(post.like_count)} onPress={() => like.mutate(post)} a11y="Gefällt mir" />
        <SideButton icon="chatbubble-outline" label={String(post.comment_count)} onPress={() => router.push(`/post/${post.id}`)} a11y="Kommentare" />
        <SideButton icon="paper-plane-outline" label="Senden" onPress={() => router.push(`/teilen/${post.id}`)} a11y="Senden an" />
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
        {post.music && <MusicLine track={post.music} light />}
        {post.venue_name && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="location-outline" size={13} color="#fff" /><Text style={st.venue}>{post.venue_name}, {post.venue_city}</Text></View>}
      </View>
    </View>
  )
})

function SideButton({ icon, label, onPress, color = '#fff', a11y }: { icon: IconName; label: string; onPress: () => void; color?: string; a11y: string }) {
  return (
    <Pressable onPress={onPress} style={st.sideBtn} hitSlop={6} accessibilityLabel={a11y}>
      <Icon name={icon} size={30} color={color} />
      {label ? <Text style={st.sideLabel}>{label}</Text> : null}
    </Pressable>
  )
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8 }
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  titleBox: { position: 'absolute', left: 16 },
  screenTitle: { color: '#fff', fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  close: { position: 'absolute', left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  mute: { position: 'absolute', right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
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
