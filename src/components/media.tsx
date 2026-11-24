import { useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useVideoPlayer, VideoView } from 'expo-video'
import { colors, radius } from '../lib/theme'
import type { FeedPost } from '../lib/types'

/** Erkennt Doppeltippen; einfaches Tippen löst optional onTap aus */
export function DoubleTap({ onDoubleTap, onTap, children, style }: { onDoubleTap: () => void; onTap?: () => void; children: ReactNode; style?: object }) {
  const last = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [heart] = useState(() => new Animated.Value(0))

  const press = () => {
    const now = Date.now()
    if (now - last.current < 280) {
      if (timer.current) clearTimeout(timer.current)
      last.current = 0
      onDoubleTap()
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      heart.setValue(0)
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
      ]).start()
    } else {
      last.current = now
      if (onTap) timer.current = setTimeout(onTap, 280)
    }
  }

  return (
    <Pressable onPress={press} style={style} accessibilityHint="Doppelt tippen, um den Beitrag zu liken" testID="doubletap">
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.center, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) }] }]}>
        <Ionicons name="heart" size={110} color="#fff" style={st.heartShadow} />
      </Animated.View>
    </Pressable>
  )
}

/** Bildergalerie zum Wischen mit Punkten und Zähler */
export function MediaCarousel({ media, onDoubleTap, aspect = 4 / 5 }: { media: string[]; onDoubleTap: () => void; aspect?: number }) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
  }
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: aspect, backgroundColor: colors.surface2 }}>
      {width > 0 && (
        <DoubleTap onDoubleTap={onDoubleTap}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32} scrollEnabled={media.length > 1}>
            {media.map((uri, i) => (
              <Image key={uri + i} source={{ uri }} style={{ width, height: width / aspect }} contentFit="cover" transition={200} accessibilityLabel={`Bild ${i + 1} von ${media.length}`} />
            ))}
          </ScrollView>
        </DoubleTap>
      )}
      {media.length > 1 && (
        <>
          <View style={st.counter}><Text style={st.counterText}>{index + 1}/{media.length}</Text></View>
          <View style={st.dots} pointerEvents="none">
            {media.map((_, i) => <View key={i} style={[st.dot, i === index && st.dotActive]} />)}
          </View>
        </>
      )}
    </View>
  )
}

/** Reel im Feed: Vorschaubild mit Play-Symbol, öffnet die Reels-Ansicht */
export function ReelPreview({ post, onDoubleTap }: { post: FeedPost; onDoubleTap: () => void }) {
  const open = () => router.navigate({ pathname: '/reels', params: { start: post.id } })
  return (
    <View style={{ width: '100%', aspectRatio: 4 / 5, backgroundColor: '#000' }}>
      <DoubleTap onDoubleTap={onDoubleTap} onTap={open} style={StyleSheet.absoluteFill}>
        {post.media[0]
          ? <Image source={{ uri: post.media[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface2 }]} />}
        <View style={[StyleSheet.absoluteFill, st.center]} pointerEvents="none">
          <View style={st.play}><Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} /></View>
        </View>
        <View style={st.reelBadge} pointerEvents="none">
          <Ionicons name="film-outline" size={14} color="#fff" />
          <Text style={st.reelText}>Reel</Text>
        </View>
      </DoubleTap>
    </View>
  )
}

/** Reel in der Detailansicht: spielt direkt mit Steuerelementen */
export function ReelPlayer({ post }: { post: FeedPost }) {
  const player = useVideoPlayer(post.video_url, p => { p.loop = true; p.play() })
  return (
    <View style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 640, backgroundColor: '#000' }}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
    </View>
  )
}

/** Text, in dem #hashtags antippbar sind (öffnen die Suche) */
export function RichText({ text, style, numberOfLines, prefix }: { text: string; style?: object; numberOfLines?: number; prefix?: ReactNode }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/u)
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {prefix}
      {parts.map((part, i) => part.startsWith('#')
        ? <Text key={i} style={{ color: colors.accentLight, fontWeight: '600' }} onPress={() => router.navigate({ pathname: '/entdecken', params: { q: part } })}>{part}</Text>
        : part)}
    </Text>
  )
}

/** Raster mit 3 Spalten wie im Instagram-Profil */
export function PostGrid({ posts }: { posts: FeedPost[] }) {
  const [width, setWidth] = useState(0)
  const size = width ? (width - 4) / 3 : 0
  return (
    <View style={st.grid} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {size > 0 && posts.map(p => (
        <Pressable
          key={p.id}
          style={[st.cell, { width: size, height: size * 1.25 }]}
          onPress={() => p.video_url ? router.navigate({ pathname: '/reels', params: { start: p.id } }) : router.push(`/post/${p.id}`)}
          accessibilityLabel={p.title ?? p.body.slice(0, 60)}
        >
          {p.media[0] ? (
            <Image source={{ uri: p.media[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <View style={[StyleSheet.absoluteFill, st.textCell]}>
              <Text style={st.textCellText} numberOfLines={5}>{p.title ?? p.body}</Text>
            </View>
          )}
          {p.video_url && <Ionicons name="film" size={18} color="#fff" style={st.cellIcon} />}
          {!p.video_url && p.media.length > 1 && <Ionicons name="copy" size={16} color="#fff" style={st.cellIcon} />}
        </Pressable>
      ))}
    </View>
  )
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  heartShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 18 },
  counter: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: '#fff', width: 7, height: 7, borderRadius: 3.5 },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' },
  reelBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  reelText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, width: '100%' },
  cell: { backgroundColor: colors.surface2, overflow: 'hidden' },
  textCell: { padding: 10, justifyContent: 'center', backgroundColor: colors.surface },
  textCellText: { color: colors.text, fontSize: 12, lineHeight: 16 },
  cellIcon: { position: 'absolute', top: 8, right: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
})
