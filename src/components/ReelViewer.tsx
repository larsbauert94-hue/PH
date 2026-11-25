import { memo, useEffect, useRef, useState } from 'react'
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
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
 * Reels zum Hoch- und Runterwischen wie bei TikTok: rechts Anstoßen, Kommentare, Senden, Merken,
 * oben rechts der Ton. Tippen pausiert, doppelt tippen stößt an.
 */
export default function ReelViewer({ posts, startId, onEndReached, paused = false, title }: {
  posts: FeedPost[]; startId?: string; onEndReached?: () => void
  paused?: boolean; title?: string
}) {
  const insets = useSafeAreaInsets()
  const [height, setHeight] = useState(0)
  const startIndex = Math.max(0, startId ? posts.findIndex(p => p.id === startId) : 0)
  const [active, setActive] = useState(startIndex)
  // Im Browser (iPhone-Safari) starten Videos nur stumm von selbst, wie bei TikTok im Web
  const [muted, setMuted] = useState(Platform.OS === 'web')
  const list = useRef<FlatList<FeedPost>>(null)
  const [muteAll] = useState(() => () => setMuted(true))
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
            <Reel post={item} height={height} playing={!paused && index === active} muted={muted} canTap={() => Date.now() - lastScroll.current > 600} onBlocked={muteAll} />
          )}
        />
      )}
      {title && (
        <View style={[st.titleBox, { top: insets.top + 10 }]} pointerEvents="none">
          <Text style={st.screenTitle}>{title}</Text>
        </View>
      )}
      {
        <Pressable onPress={() => setMuted(m => !m)} style={[st.mute, { top: insets.top + 8 }]} hitSlop={10} accessibilityRole="button" accessibilityLabel={muted ? 'Ton an' : 'Ton aus'}>
          <Icon name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
        </Pressable>
      }
    </View>
  )
}

const Reel = memo(function Reel({ post, height, playing, muted, canTap, onBlocked }: { post: FeedPost; height: number; playing: boolean; muted: boolean; canTap: () => boolean; onBlocked: () => void }) {
  const like = useToggleLike()
  const save = useToggleSave()
  const player = useVideoPlayer(post.video_url, p => { p.loop = true })
  // Tippen pausiert wie bei TikTok; beim Weiterwischen wird die Pause zurückgesetzt
  const [paused, setPaused] = useState(false)
  const [wasPlaying, setWasPlaying] = useState(playing)
  if (playing !== wasPlaying) { setWasPlaying(playing); if (!playing) setPaused(false) }

  // expo-video wird über Eigenschaften am Player gesteuert
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { player.muted = muted }, [player, muted])
  useEffect(() => {
    if (playing && !paused) {
      player.play()
      // Blockiert der Browser das Abspielen mit Ton, stumm weiterspielen
      if (Platform.OS === 'web' && !muted) {
        const id = setTimeout(() => { if (!player.playing) onBlocked() }, 700)
        return () => clearTimeout(id)
      }
    } else if (playing) player.pause()
    // eslint-disable-next-line react-hooks/immutability
    else { player.pause(); player.currentTime = 0 }
  }, [player, playing, paused, muted, onBlocked])


  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {post.media[0] && <Image source={{ uri: post.media[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <VideoView player={player} playsInline style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <DoubleTap onDoubleTap={() => { if (!post.liked_by_me) like.mutate(post) }} onTap={() => { if (canTap()) setPaused(x => !x) }}>
        <View style={{ height }} />
      </DoubleTap>
      {paused && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <View style={st.muteBubble}><Icon name="play" size={32} color="#fff" /></View>
        </View>
      )}

      <View style={st.side}>
        <SideButton icon={post.liked_by_me ? 'cheers' : 'cheers-outline'} color={post.liked_by_me ? colors.accent : '#fff'} label={String(post.like_count)} onPress={() => like.mutate(post)} a11y="Gefällt mir" />
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
