import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Icon } from './Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../lib/auth'
import { api } from '../lib/api'
import { useDeleteStory, useMarkStorySeen } from '../lib/queries'
import { timeAgo } from '../lib/labels'
import { colors } from '../lib/theme'
import type { Story, StoryGroup } from '../lib/types'
import { StoryOverlayLayer } from './storyOverlays'
import { MusicLine } from './music'
import { Avatar } from './ui'
import { chooseAction, confirmAction, notify } from './report'

const IMAGE_MS = 5000

/**
 * Vollbild-Ansicht für Storys und Highlights.
 * groups: Storys je Person; startAuthor: bei wem begonnen wird; highlightTitle: Highlight-Modus.
 */
export default function StoryPlayer({ groups, startAuthor, highlightTitle }: { groups: StoryGroup[]; startAuthor?: string; highlightTitle?: string }) {
  const id = startAuthor
  const { me } = useMe()
  const insets = useSafeAreaInsets()
  const markSeen = useMarkStorySeen()
  const del = useDeleteStory()
  const [screen, setScreen] = useState({ w: 0, h: 0 })
  const [g, setG] = useState(() => Math.max(0, groups.findIndex(x => x.author_id === id)))
  const [s, setS] = useState(() => {
    const grp = groups[Math.max(0, groups.findIndex(x => x.author_id === id))]
    const firstUnseen = grp?.stories.findIndex(x => !x.seen_by_me) ?? 0
    return grp && grp.author_id !== me && firstUnseen > 0 ? firstUnseen : 0
  })
  const [paused, setPaused] = useState(false)
  const [reply, setReply] = useState('')
  const [typing, setTyping] = useState(false)
  const [progress] = useState(() => new Animated.Value(0))
  const done = useRef(0)
  useEffect(() => {
    const l = progress.addListener(({ value }) => { done.current = value })
    return () => progress.removeListener(l)
  }, [progress])

  const group = groups[g]
  const story: Story | undefined = group?.stories[s]
  const own = group?.author_id === me

  const close = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/') }, [])
  const next = useCallback(() => {
    if (!group) return close()
    if (s < group.stories.length - 1) setS(s + 1)
    else if (g < groups.length - 1) { setG(g + 1); setS(0) }
    else close()
  }, [g, s, group, groups.length, close])
  const prev = useCallback(() => {
    if (s > 0) setS(s - 1)
    else if (g > 0) { setG(g - 1); setS(groups[g - 1].stories.length - 1) }
    else progress.setValue(0)
  }, [g, s, groups, progress])

  // Gesehen markieren
  const { mutate: mark } = markSeen
  useEffect(() => { if (story && !own && !story.seen_by_me && !highlightTitle) mark(story.id) }, [story, own, mark, highlightTitle])

  // Fortschritt animieren (Videos: Länge des Videos, sonst 5 Sekunden)
  const player = useVideoPlayer(story?.media_type === 'video' ? story.media_url : null, p => { p.loop = false; p.muted = false })
  const [videoLen, setVideoLen] = useState<{ id: string; ms: number } | null>(null)
  const videoMs = videoLen && videoLen.id === story?.id ? videoLen.ms : null
  useEffect(() => { progress.setValue(0) }, [story?.id, progress])
  useEffect(() => {
    if (!story || story.media_type !== 'video') return
    const storyId = story.id
    const sub = player.addListener('statusChange', ({ status }) => { if (status === 'readyToPlay' && player.duration) setVideoLen({ id: storyId, ms: player.duration * 1000 }) })
    const end = player.addListener('playToEnd', () => next())
    return () => { sub.remove(); end.remove() }
  }, [player, story, next])

  const hold = paused || typing
  useEffect(() => {
    if (!story) return
    const total = story.media_type === 'video' ? (videoMs ?? 15000) : IMAGE_MS
    if (hold) {
      progress.stopAnimation()
      if (story.media_type === 'video') player.pause()
      return
    }
    if (story.media_type === 'video') player.play()
    const anim = Animated.timing(progress, { toValue: 1, duration: total * (1 - done.current), useNativeDriver: false })
    anim.start(({ finished }) => { if (finished && story.media_type !== 'video') next() })
    return () => anim.stop()
  }, [story, hold, videoMs, progress, next, player])

  // Nach unten wischen schließt
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, gs) => gs.dy > 12 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderRelease: (_e, gs) => { if (gs.dy > 80) { if (router.canGoBack()) router.back(); else router.replace('/') } },
  }))

  const sendReply = async () => {
    const text = reply.trim()
    if (!text || !story) return
    setReply('')
    try {
      const conv = await api.startConversation(story.author_id)
      await api.sendMessage(me, conv, `↩︎ Antwort auf deine Story${story.caption ? ` „${story.caption}“` : ''}:\n${text}`)
      notify('Gesendet', `Deine Antwort ist bei ${story.author_name.split(' ')[0]} angekommen.`)
    } catch (e) {
      notify('Nicht gesendet', e instanceof Error ? e.message : String(e))
    }
  }

  const ownMenu = () => story && chooseAction('Deine Story', [
    { label: 'Löschen', destructive: true, onPress: () => confirmAction('Story löschen?', 'Sie verschwindet sofort für alle.', 'Löschen', () => { del.mutate(story.id); next() }) },
  ])

  if (!group || !story) {
    return (
      <View style={[st.root, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <Text style={{ color: '#fff' }}>Diese Story ist nicht mehr verfügbar.</Text>
        <Pressable onPress={close}><Text style={{ color: colors.accent }}>Schließen</Text></Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} {...pan.panHandlers} onLayout={e => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {story.media_type === 'video'
        ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        : <Image source={{ uri: story.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}

      {/* Tippzonen: links zurück, rechts weiter, gedrückt halten pausiert */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <Pressable style={{ flex: 3 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={200} accessibilityLabel="Vorherige Story" />
        <Pressable style={{ flex: 7 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={200} accessibilityLabel="Nächste Story" />
      </View>

      <View style={[st.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={st.bars}>
          {group.stories.map((x, i) => (
            <View key={x.id} style={st.bar}>
              <Animated.View style={[st.barFill, { width: i < s ? '100%' : i > s ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
            </View>
          ))}
        </View>
        <View style={st.head}>
          <Pressable style={st.author} onPress={() => { close(); router.push(`/profil/${group.author_id}`) }}>
            <Avatar name={group.author_name} url={group.author_avatar_url} type={group.author_type} size={34} />
            <View style={{ flexShrink: 1, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={st.name} numberOfLines={1}>{highlightTitle ?? (own ? 'Deine Story' : group.author_name)}</Text>
                <Text style={st.time}>{timeAgo(story.created_at)}</Text>
              </View>
              {story.music && <MusicLine track={story.music} light />}
            </View>
          </Pressable>
          {own && <Pressable onPress={ownMenu} hitSlop={10} accessibilityLabel="Optionen"><Icon name="ellipsis-horizontal" size={24} color="#fff" /></Pressable>}
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Schließen"><Icon name="close" size={30} color="#fff" /></Pressable>
        </View>
      </View>

      {screen.w > 0 && !!story.overlays?.length && <StoryOverlayLayer overlays={story.overlays} width={screen.w} height={screen.h} storyId={story.id} />}
      {/* Bildunterschrift nur, wenn kein eigener Text-Sticker vorhanden ist */}
      {story.caption && !story.overlays?.some(o => o.type === 'text') ? (
        <View style={st.captionWrap} pointerEvents="none">
          <Text style={st.caption}>{story.caption}</Text>
        </View>
      ) : null}

      <View style={[st.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {highlightTitle && !own ? null : own ? (
          <View style={st.views}>
            <Icon name="eye-outline" size={20} color="#fff" />
            <Text style={st.viewsText}>{story.view_count === 1 ? '1 Aufruf' : `${story.view_count} Aufrufe`}</Text>
          </View>
        ) : (
          <View style={st.replyRow}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              placeholder={`Antworten an ${group.author_name.split(' ')[0]} …`}
              placeholderTextColor="rgba(255,255,255,0.75)"
              style={st.replyInput}
              onSubmitEditing={sendReply}
              returnKeyType="send"
            />
            <Pressable onPress={sendReply} hitSlop={8} accessibilityLabel="Antwort senden">
              <Icon name="paper-plane-outline" size={26} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: '#fff', fontWeight: '700', fontSize: 15, flexShrink: 1, ...shadow },
  time: { color: 'rgba(255,255,255,0.8)', fontSize: 13, ...shadow },
  captionWrap: { position: 'absolute', left: 24, right: 24, bottom: '22%', alignItems: 'center' },
  caption: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  replyInput: { flex: 1, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11 },
  views: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  viewsText: { color: '#fff', fontWeight: '600' },
})
