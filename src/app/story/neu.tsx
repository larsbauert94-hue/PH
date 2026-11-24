import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../../lib/auth'
import { useCreateStory } from '../../lib/queries'
import { pickMedia } from '../../lib/pickImage'
import { editPhotos } from '../../lib/editor'
import { musicPicker, personPicker, venuePicker } from '../../lib/picker'
import { colors } from '../../lib/theme'
import type { LocalFile, StoryOverlay } from '../../lib/types'
import { Avatar, type IconName } from '../../components/ui'
import { notify } from '../../components/report'
import { DraggableOverlay, TEXT_COLORS, TrashZone } from '../../components/storyOverlays'

type Media = LocalFile & { type: 'image' | 'video' }
interface TextDraft { index: number | null; text: string; color: string; background: boolean }

export default function NewStory() {
  const insets = useSafeAreaInsets()
  const { profile } = useMe()
  const create = useCreateStory()
  const [file, setFile] = useState<Media | null>(null)
  const [overlays, setOverlays] = useState<StoryOverlay[]>([])
  const [draft, setDraft] = useState<TextDraft | null>(null)
  const [drag, setDrag] = useState({ active: false, overTrash: false })
  const [size, setSize] = useState({ w: 0, h: 0 })
  const player = useVideoPlayer(file?.type === 'video' ? file.uri : null, p => { p.loop = true; p.muted = true; p.play() })

  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/') }

  const pick = async (camera: boolean) => {
    const [m] = await pickMedia({ camera, video: true, imagesToo: true, edit: false, maxVideoSeconds: 30 })
    if (!m) return
    if (m.type === 'video') { setFile(m); return }
    // Fotos vorher durch den Filter-Editor schicken
    const edited = await editPhotos([m], 9 / 16)
    if (edited?.[0]) setFile({ ...edited[0], type: 'image' })
  }

  const add = (o: StoryOverlay) => setOverlays(prev => [...prev, o])
  const addMusic = async () => { const t = await musicPicker.open(); if (t) add({ type: 'music', track: t, x: 0.5, y: 0.25 }) }
  const addLocation = async () => { const v = await venuePicker.open(); if (v) add({ type: 'location', venue_id: v.id, name: v.name, x: 0.5, y: 0.18 }) }
  const addMention = async () => { const p = await personPicker.open(); if (p) add({ type: 'mention', profile_id: p.id, handle: p.handle, x: 0.5, y: 0.7 }) }

  const saveText = () => {
    if (!draft) return
    const text = draft.text.trim()
    setOverlays(prev => {
      const others = draft.index === null ? prev : prev.filter((_, i) => i !== draft.index)
      if (!text) return others
      const old = draft.index !== null ? prev[draft.index] : null
      return [...others, { type: 'text', text, color: draft.color, background: draft.background, x: old?.x ?? 0.5, y: old?.y ?? 0.42 }]
    })
    setDraft(null)
  }

  const share = () => {
    if (!file) return
    const music = overlays.find(o => o.type === 'music')
    const loc = overlays.find(o => o.type === 'location')
    const firstText = overlays.find(o => o.type === 'text')
    create.mutate({
      file, media_type: file.type, overlays,
      caption: firstText?.type === 'text' ? firstText.text : undefined,
      music: music?.type === 'music' ? music.track : undefined,
      venue_id: loc?.type === 'location' ? loc.venue_id : undefined,
    }, {
      onSuccess: close,
      onError: e => notify('Story konnte nicht geteilt werden', e.message),
    })
  }

  if (!file) {
    return (
      <View style={[st.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <View style={st.topRow}>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Schließen"><Ionicons name="close" size={30} color="#fff" /></Pressable>
          <Text style={st.heading}>Neue Story</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={st.empty}>
          <Ionicons name="sparkles-outline" size={46} color={colors.accent} />
          <Text style={st.emptyTitle}>Teile einen Moment</Text>
          <Text style={st.emptyText}>Mit Filtern, Text, Musik, Ort und Erwähnungen. Storys sind 24 Stunden sichtbar.</Text>
        </View>
        <View style={{ gap: 12, paddingHorizontal: 24 }}>
          {Platform.OS !== 'web' && (
            <Pressable style={[st.bigBtn, { backgroundColor: colors.accent }]} onPress={() => pick(true)}>
              <Ionicons name="camera" size={22} color={colors.onAccent} />
              <Text style={[st.bigBtnText, { color: colors.onAccent }]}>Kamera</Text>
            </Pressable>
          )}
          <Pressable style={[st.bigBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]} onPress={() => pick(false)}>
            <Ionicons name="images" size={22} color="#fff" />
            <Text style={st.bigBtnText}>Foto oder Video auswählen</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const tools: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'text', label: 'Text', onPress: () => setDraft({ index: null, text: '', color: '#ffffff', background: false }) },
    { icon: 'musical-notes', label: 'Musik', onPress: addMusic },
    { icon: 'location', label: 'Ort', onPress: addLocation },
    { icon: 'at', label: 'Erwähnen', onPress: addMention },
  ]

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={StyleSheet.absoluteFill} onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {file.type === 'video'
          ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
          : <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        {size.w > 0 && overlays.map((o, i) => (
          <DraggableOverlay
            key={i}
            o={o}
            width={size.w}
            height={size.h}
            onChange={n => setOverlays(prev => prev.map((x, j) => j === i ? n : x))}
            onRemove={() => setOverlays(prev => prev.filter((_, j) => j !== i))}
            onTap={o.type === 'text' ? () => setDraft({ index: i, text: o.text, color: o.color, background: o.background }) : undefined}
            onDragging={(active, overTrash) => setDrag({ active, overTrash })}
          />
        ))}
      </View>

      {drag.active ? <TrashZone active={drag.overTrash} /> : (
        <>
          <View style={[st.topRow, { position: 'absolute', top: insets.top + 12, left: 16, right: 16 }]}>
            <Pressable onPress={() => { setFile(null); setOverlays([]) }} hitSlop={10} style={st.round} accessibilityLabel="Zurück"><Ionicons name="chevron-back" size={24} color="#fff" /></Pressable>
          </View>
          <View style={[st.tools, { top: insets.top + 12 }]}>
            {tools.map(t => (
              <Pressable key={t.label} onPress={t.onPress} style={st.tool} accessibilityLabel={t.label}>
                <View style={st.round}><Ionicons name={t.icon} size={22} color="#fff" /></View>
                <Text style={st.toolLabel}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[st.bottom, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={st.shareBtn} onPress={share} disabled={create.isPending} accessibilityRole="button" accessibilityLabel="Story teilen">
              <Avatar name={profile.name} url={profile.avatar_url} type={profile.account_type} size={30} />
              <Text style={st.shareText}>{create.isPending ? 'Wird geteilt …' : 'Deine Story'}</Text>
              <Ionicons name="arrow-forward-circle" size={28} color={colors.onAccent} />
            </Pressable>
          </View>
        </>
      )}

      {draft && (
        <View style={st.textEditor}>
          <View style={[st.topRow, { paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => setDraft({ ...draft, background: !draft.background })} style={st.round} accessibilityLabel="Hintergrund umschalten">
              <Ionicons name={draft.background ? 'text' : 'text-outline'} size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={saveText} hitSlop={10}><Text style={st.doneText}>Fertig</Text></Pressable>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            <TextInput
              value={draft.text}
              onChangeText={text => setDraft({ ...draft, text })}
              autoFocus
              multiline
              placeholder="Text eingeben …"
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={[st.textInput, { color: draft.color }, draft.background && { backgroundColor: draft.color === '#111111' ? '#fff' : 'rgba(0,0,0,0.55)', borderRadius: 10 }]}
              maxLength={200}
            />
          </View>
          <View style={[st.colors, { paddingBottom: insets.bottom + 16 }]}>
            {TEXT_COLORS.map(c => (
              <Pressable key={c} onPress={() => setDraft({ ...draft, color: c })} style={[st.color, { backgroundColor: c }, draft.color === c && st.colorActive]} accessibilityLabel={`Farbe ${c}`} />
            ))}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  heading: { color: '#fff', fontSize: 18, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  bigBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  tools: { position: 'absolute', right: 12, gap: 14, alignItems: 'center' },
  tool: { alignItems: 'center', gap: 3 },
  toolLabel: { color: '#fff', fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-end', paddingHorizontal: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accent, borderRadius: 30, paddingLeft: 8, paddingRight: 10, paddingVertical: 8 },
  shareText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  textEditor: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  doneText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  textInput: { fontSize: 30, fontWeight: '800', textAlign: 'center', padding: 12 },
  colors: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingTop: 12 },
  color: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  colorActive: { transform: [{ scale: 1.25 }], borderColor: '#fff', borderWidth: 3 },
})
