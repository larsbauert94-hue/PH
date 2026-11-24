import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '../../lib/auth'
import { useCreatePost, useVenues } from '../../lib/queries'
import { pickMedia, type PickedMedia } from '../../lib/pickImage'
import { ACCOUNT_TYPES, CATEGORIES, POST_KINDS } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { Category, LocalFile, PostKind } from '../../lib/types'
import { Button, Chip, Field, IconName, SectionLabel } from '../../components/ui'
import { notify } from '../../components/report'

type Mode = 'beitrag' | 'reel'

const TITLE_HINT: Record<PostKind, string> = {
  beitrag: 'Titel (optional)',
  neuheit: 'Produktname, z. B. „Zirbe Dry Gin“',
  angebot: 'z. B. „Winteraktion für Gastro-Kunden“',
  event: 'Name und Datum, z. B. „Tasting am 14. Dezember“',
  job: 'Position, z. B. „Bartender:in (Vollzeit)“',
}

export default function NewPost() {
  const { profile } = useMe()
  const create = useCreatePost()
  const venues = useVenues()
  const business = ACCOUNT_TYPES[profile.account_type].business
  // Privatpersonen teilen Beiträge; Betriebe und Gastro-Profis zusätzlich Neuheiten, Angebote, Events und Jobs
  const kinds: PostKind[] = profile.account_type === 'privat' ? ['beitrag'] : business ? ['beitrag', 'neuheit', 'angebot', 'event', 'job'] : ['beitrag', 'event', 'job']

  const [mode, setMode] = useState<Mode>('beitrag')
  const [kind, setKind] = useState<PostKind>('beitrag')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>('wein')
  const [link, setLink] = useState('')
  const [venueId, setVenueId] = useState<string | null>(null)
  const [venueSearch, setVenueSearch] = useState('')
  const [images, setImages] = useState<PickedMedia[]>([])
  const [video, setVideo] = useState<PickedMedia | null>(null)
  const scroll = useRef<ScrollViewInstance>(null)
  const player = useVideoPlayer(video?.uri ?? null, p => { p.loop = true; p.muted = true; p.play() })

  const isReel = mode === 'reel'
  const needsTitle = !isReel && kind !== 'beitrag'
  const canPost = isReel ? !!video : body.trim().length > 0 && (!needsTitle || title.trim().length > 0)

  const addImages = async (camera: boolean) => {
    const picked = await pickMedia({ camera, multiple: !camera, edit: camera, aspect: [4, 5] })
    if (picked.length) setImages(prev => [...prev, ...picked].slice(0, 10))
  }
  const pickVideo = async (camera: boolean) => {
    const [v] = await pickMedia({ camera, video: true, maxVideoSeconds: 60 })
    if (!v) return
    if (v.duration && v.duration > 61_000) { notify('Zu lang', 'Reels dürfen höchstens 60 Sekunden lang sein.'); return }
    setVideo(v)
  }

  const reset = () => {
    setKind('beitrag'); setTitle(''); setBody(''); setLink(''); setVenueId(null); setVenueSearch(''); setImages([]); setVideo(null)
  }

  const submit = async () => {
    const url = link.trim()
    let media: LocalFile[] = images
    if (isReel && video) {
      // Vorschaubild aus dem Video erzeugen (im Browser nicht verfügbar)
      media = []
      if (Platform.OS !== 'web') {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(video.uri, { time: 500, quality: 0.7 })
          media = [{ uri: thumb.uri, mime: 'image/jpeg' }]
        } catch { /* ohne Vorschaubild weiter */ }
      }
    }
    create.mutate({
      kind: isReel ? 'beitrag' : kind,
      title: title.trim() || undefined,
      body: body.trim() || (isReel ? '🎬' : ''),
      category,
      link_url: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : undefined,
      venue_id: venueId ?? undefined,
      media,
      video: isReel && video ? video : undefined,
    }, {
      onSuccess: () => { reset(); scroll.current?.scrollTo({ y: 0, animated: false }); router.navigate(isReel ? '/reels' : '/') },
      onError: e => notify('Fehler beim Posten', e.message),
    })
  }

  const venueMatches = venueSearch.trim()
    ? (venues.data ?? []).filter(v => `${v.name} ${v.city}`.toLowerCase().includes(venueSearch.trim().toLowerCase())).slice(0, 5)
    : []
  const chosenVenue = venues.data?.find(v => v.id === venueId)

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.segment}>
          {([['beitrag', 'Beitrag', 'grid-outline'], ['story', 'Story', 'add-circle-outline'], ['reel', 'Reel', 'film-outline']] as const).map(([k, label, icon]) => {
            const active = mode === k
            return (
              <Pressable key={k} style={[st.segItem, active && st.segActive]} onPress={() => k === 'story' ? router.push('/story/neu') : setMode(k)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}>
                <Ionicons name={icon} size={18} color={active ? colors.onAccent : colors.muted} />
                <Text style={[st.segText, active && { color: colors.onAccent }]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>

        {isReel ? (
          video ? (
            <View style={st.videoBox}>
              <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
              <Pressable onPress={() => setVideo(null)} style={st.remove} accessibilityLabel="Video entfernen"><Ionicons name="close" size={18} color="#fff" /></Pressable>
            </View>
          ) : (
            <View style={st.pickBox}>
              <Ionicons name="film-outline" size={40} color={colors.accent} />
              <Text style={st.pickTitle}>Video für dein Reel</Text>
              <Text style={st.pickText}>Hochformat, bis 60 Sekunden</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                {Platform.OS !== 'web' && <Button title="Aufnehmen" icon="videocam-outline" variant="secondary" onPress={() => pickVideo(true)} />}
                <Button title="Auswählen" icon="images-outline" onPress={() => pickVideo(false)} />
              </View>
            </View>
          )
        ) : (
          <>
            {kinds.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {kinds.map(k => <Chip key={k} label={POST_KINDS[k].label} icon={POST_KINDS[k].icon as IconName} active={kind === k} onPress={() => setKind(k)} />)}
              </ScrollView>
            )}
            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {images.map((img, i) => (
                  <View key={img.uri + i}>
                    <Image source={{ uri: img.uri }} style={st.thumb} contentFit="cover" />
                    <Pressable onPress={() => setImages(images.filter((_, j) => j !== i))} style={st.remove} accessibilityLabel={`Bild ${i + 1} entfernen`}><Ionicons name="close" size={16} color="#fff" /></Pressable>
                    {i === 0 && <View style={st.coverTag}><Text style={st.coverText}>Titelbild</Text></View>}
                  </View>
                ))}
                {images.length < 10 && (
                  <Pressable style={[st.thumb, st.addThumb]} onPress={() => addImages(false)} accessibilityLabel="Weitere Fotos hinzufügen">
                    <Ionicons name="add" size={30} color={colors.accent} />
                  </Pressable>
                )}
              </ScrollView>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {Platform.OS !== 'web' && <Button title="Kamera" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => addImages(true)} />}
                <Button title="Fotos (bis 10)" icon="images-outline" variant="secondary" style={{ flex: 1 }} onPress={() => addImages(false)} />
              </View>
            )}
            <Field label={needsTitle ? 'Titel' : undefined} value={title} onChangeText={setTitle} placeholder={TITLE_HINT[kind]} maxLength={140} />
          </>
        )}

        <Field value={body} onChangeText={setBody} multiline placeholder={isReel ? 'Bildunterschrift … #hashtags' : kind === 'job' ? 'Aufgaben, Anforderungen, wie man sich bewirbt …' : 'Was gibt es Neues? #hashtags'} maxLength={3000} />

        <SectionLabel>Kategorie</SectionLabel>
        <View style={st.wrap}>
          {(Object.keys(CATEGORIES) as Category[]).map(c => <Chip key={c} label={CATEGORIES[c]} active={category === c} onPress={() => setCategory(c)} />)}
        </View>

        <SectionLabel>Ort markieren (optional)</SectionLabel>
        {chosenVenue ? (
          <Pressable style={st.venue} onPress={() => setVenueId(null)}>
            <Ionicons name="location" size={18} color={colors.accent} />
            <Text style={{ color: colors.text, flex: 1 }}>{chosenVenue.name}, {chosenVenue.city}</Text>
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </Pressable>
        ) : (
          <>
            <Field value={venueSearch} onChangeText={setVenueSearch} placeholder="Bar oder Restaurant suchen" />
            {venueMatches.map(v => (
              <Pressable key={v.id} style={st.venue} onPress={() => { setVenueId(v.id); setVenueSearch('') }}>
                <Ionicons name="location-outline" size={18} color={colors.muted} />
                <Text style={{ color: colors.text }}>{v.name}, {v.city}</Text>
              </Pressable>
            ))}
          </>
        )}

        {!isReel && kind !== 'beitrag' && <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="www.beispiel.de" autoCapitalize="none" keyboardType="url" />}

        <Button title={create.isPending ? 'Wird hochgeladen …' : isReel ? 'Reel teilen' : 'Teilen'} icon="send" onPress={submit} loading={create.isPending} disabled={!canPost} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.accent },
  segText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 110, height: 138, borderRadius: radius.md, backgroundColor: colors.surface2 },
  addThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border },
  coverTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  coverText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  remove: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 4 },
  videoBox: { width: '62%', aspectRatio: 9 / 16, alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  pickBox: { alignItems: 'center', gap: 6, padding: 28, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  pickTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  pickText: { color: colors.muted, fontSize: 13 },
  venue: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
})
