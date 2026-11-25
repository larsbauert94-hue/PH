import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Icon } from '../../components/Icon'
import { useMe } from '../../lib/auth'
import { api } from '../../lib/api'
import { newlyEarned } from '../../lib/badges'
import { useCreatePost, useGroup, usePost, useVenues } from '../../lib/queries'
import { pickMedia, type PickedMedia } from '../../lib/pickImage'
import { editPhotos } from '../../lib/editor'
import { musicPicker, personPicker, productPicker, venuePicker } from '../../lib/picker'
import { MusicCover } from '../../components/music'
import MentionSuggest from '../../components/MentionSuggest'
import { ACCOUNT_TYPES, AROMAS, CATEGORIES, POST_KINDS } from '../../lib/labels'
import { colors, fonts, radius } from '../../lib/theme'
import type { Category, LocalFile, PostKind, Product, Profile, Template, Track } from '../../lib/types'
import { AromaChips, DropRating, TemplateCard } from '../../components/checkin'
import { Button, Chip, Field, IconName } from '../../components/ui'
import { FadeIn, PressScale, tap } from '../../components/motion'
import { notify } from '../../components/report'

type Mode = 'beitrag' | 'reel'

const KIND_INFO: Record<PostKind, { title: string; hint: string; color: string }> = {
  beitrag: { title: 'Neuer Beitrag', hint: 'Fotos, Galerie & Text', color: colors.accent },
  neuheit: { title: 'Neuheit', hint: 'Produkt vorstellen', color: '#e8c36a' },
  angebot: { title: 'Angebot', hint: 'Aktion für Kunden', color: '#7cc4a0' },
  event: { title: 'Event', hint: 'Tasting, Party, Messe', color: colors.lavender },
  job: { title: 'Job', hint: 'Stelle ausschreiben', color: colors.heart },
  checkin: { title: 'Check-in', hint: 'Drink bewerten', color: colors.accentLight },
  rezept: { title: 'Rezept', hint: 'Zum Nachmixen', color: '#e8c36a' },
}

const TITLE_HINT: Record<PostKind, string> = {
  beitrag: 'Titel (optional)',
  neuheit: 'Produktname, z. B. „Zirbe Dry Gin“',
  angebot: 'z. B. „Winteraktion für Gastro-Kunden“',
  event: 'Name und Datum, z. B. „Tasting am 14. Dezember“',
  job: 'Position, z. B. „Bartender:in (Vollzeit)“',
  checkin: 'Titel (optional)',
  rezept: 'Name des Drinks, z. B. „Smoked Negroni“',
}

const TEMPLATES: { key: Template; label: string }[] = [{ key: 'karte', label: 'Menükarte' }, { key: 'plakat', label: 'Event-Plakat' }, { key: 'neuheit', label: 'Neuheit' }]

export default function NewPost() {
  const { me, profile } = useMe()
  const create = useCreatePost()
  const venues = useVenues()
  const business = ACCOUNT_TYPES[profile.account_type].business
  // Privatpersonen teilen Beiträge; Betriebe und Gastro-Profis zusätzlich Neuheiten, Angebote, Events und Jobs
  const kinds: PostKind[] = profile.account_type === 'privat' ? ['beitrag'] : business ? ['beitrag', 'neuheit', 'angebot', 'event', 'job'] : ['beitrag', 'event', 'job']

  const [mode, setMode] = useState<Mode | null>(null)
  const [kind, setKind] = useState<PostKind>('beitrag')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>('wein')
  const [link, setLink] = useState('')
  const [venueId, setVenueId] = useState<string | null>(null)
  const [images, setImages] = useState<PickedMedia[]>([])
  const [video, setVideo] = useState<PickedMedia | null>(null)
  const [music, setMusic] = useState<Track | null>(null)
  const [rating, setRating] = useState(0)
  const [aromas, setAromas] = useState<string[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }])
  const [steps, setSteps] = useState([''])
  const [template, setTemplate] = useState<Template | null>(null)
  const [collab, setCollab] = useState<Profile | null>(null)
  const [urgent, setUrgent] = useState(false)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [remixOf, setRemixOf] = useState<string | null>(null)
  const scroll = useRef<ScrollViewInstance>(null)

  // Aufruf mit Vorgaben: Nachmixen, Beitrag in einem Raum, Teilnahme an der Challenge
  const params = useLocalSearchParams<{ remix?: string; group?: string; tag?: string; checkin?: string }>()
  const paramKey = JSON.stringify(params)
  const [seenParams, setSeenParams] = useState('{}')
  if (paramKey !== seenParams) {
    setSeenParams(paramKey)
    if (params.remix) { setMode('beitrag'); setKind('beitrag'); setRemixOf(params.remix); setCategory('cocktails') }
    if (params.group) { setMode('beitrag'); setKind('beitrag'); setGroupId(params.group) }
    if (params.tag) { setMode('beitrag'); setKind('beitrag'); setBody(b => b.includes(params.tag!) ? b : `${b} ${params.tag}`.trim()) }
    if (params.checkin) { setMode('beitrag'); setKind('checkin') }
  }
  const remixPost = usePost(remixOf ?? '')
  const group = useGroup(groupId ?? '')
  const player = useVideoPlayer(video?.uri ?? null, p => { p.loop = true; p.muted = true; p.play() })

  const isReel = mode === 'reel'
  const isCheckin = !isReel && kind === 'checkin'
  const isRecipe = !isReel && kind === 'rezept'
  const needsTitle = !isReel && !['beitrag', 'checkin'].includes(kind)
  const recipe = { ingredients: ingredients.filter(i => i.name.trim()).map(i => ({ name: i.name.trim(), amount: i.amount.trim() })), steps: steps.map(x => x.trim()).filter(Boolean) }
  const canPost = isReel ? !!video
    : isCheckin ? rating > 0
    : isRecipe ? title.trim().length > 0 && recipe.ingredients.length > 0 && recipe.steps.length > 0
    : (body.trim().length > 0 || !!template) && (!needsTitle || title.trim().length > 0)

  const addImages = async (camera: boolean) => {
    const picked = await pickMedia({ camera, multiple: !camera, edit: camera, aspect: [4, 5] })
    if (!picked.length) return
    // Filter und Anpassungen wie bei Instagram
    const edited = await editPhotos(picked.slice(0, 10 - images.length), 4 / 5)
    if (edited) setImages(prev => [...prev, ...edited.map(f => ({ ...f, type: 'image' as const }))].slice(0, 10))
  }
  const pickVideo = async (camera: boolean) => {
    const [v] = await pickMedia({ camera, video: true, maxVideoSeconds: 60 })
    if (!v) return
    if (v.duration && v.duration > 61_000) { notify('Zu lang', 'Reels dürfen höchstens 60 Sekunden lang sein.'); return }
    setVideo(v)
  }

  const reset = () => {
    setMode(null); setKind('beitrag'); setTitle(''); setBody(''); setLink(''); setVenueId(null); setImages([]); setVideo(null); setMusic(null)
    setRating(0); setAromas([]); setProduct(null); setIngredients([{ name: '', amount: '' }]); setSteps(['']); setTemplate(null); setCollab(null); setUrgent(false); setGroupId(null); setRemixOf(null)
    router.setParams({ remix: undefined, group: undefined, tag: undefined, checkin: undefined })
  }

  const submit = async () => {
    const url = link.trim()
    // Stand vor dem Posten, um neue Abzeichen zu erkennen
    const before = await api.getCheckinSummary(me).catch(() => undefined)
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
      music: music ?? undefined,
      rating: isCheckin ? rating : undefined,
      aromas: isCheckin ? aromas : undefined,
      product_id: isCheckin ? product?.id : undefined,
      recipe: isRecipe ? recipe : undefined,
      remix_of: remixOf ?? undefined,
      collab_id: collab?.id,
      group_id: groupId ?? undefined,
      urgent: kind === 'job' && urgent,
      template: !images.length && template ? template : undefined,
    }, {
      onSuccess: async () => {
        const target = isReel ? '/reels' : groupId ? `/raum/${groupId}` : '/'
        reset(); scroll.current?.scrollTo({ y: 0, animated: false }); router.navigate(target as '/')
        const fresh = before ? newlyEarned(before, await api.getCheckinSummary(me)) : []
        if (fresh.length) router.push({ pathname: '/abzeichen/[id]', params: { id: me, neu: fresh.map(b => b.id).join(',') } })
      },
      onError: e => notify('Fehler beim Posten', e.message),
    })
  }

  const chosenVenue = venues.data?.find(v => v.id === venueId)

  const start = (m: Mode, k: PostKind = 'beitrag') => { tap('select'); setMode(m); setKind(k) }

  if (!mode) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={st.content}>
        <FadeIn>
          <Text style={st.h1}>Was möchtest du teilen?</Text>
          <Text style={st.lead}>Wähle aus, der Rest ist in wenigen Schritten erledigt.</Text>
        </FadeIn>
        {([
          ['beitrag', 'Beitrag', 'Fotos, Galerie & Text', 'images-outline'],
          ['checkin', 'Check-in', 'Drink bewerten, Ort und Flasche markieren', 'cheers-outline'],
          ['story', 'Story', '24 Stunden sichtbar, mit Stickern & Musik', 'water-outline'],
          ['reel', 'Reel', 'Hochformat-Video bis 60 Sekunden', 'film-outline'],
          ['rezept', 'Rezept', 'Zutaten und Schritte zum Nachmixen', 'flask-outline'],
        ] as const).map(([k, label, hint, icon], i) => (
          <FadeIn key={k} delay={80 + i * 70}>
            <PressScale
              style={st.bigCard}
              onPress={() => k === 'story' ? router.push('/story/neu') : k === 'checkin' || k === 'rezept' ? start('beitrag', k) : start(k)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View style={st.bigIcon}><Icon name={icon} size={26} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.bigTitle}>{label}</Text>
                <Text style={st.bigHint}>{hint}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.faint} />
            </PressScale>
          </FadeIn>
        ))}
        {kinds.length > 1 && (
          <FadeIn delay={430}>
            <Text style={st.groupLabel}>{business ? 'Für deinen Betrieb' : 'Für Gastro-Profis'}</Text>
            <View style={st.tiles}>
              {kinds.filter(k => k !== 'beitrag').map(k => (
                <PressScale key={k} wrapStyle={st.tileWrap} style={st.tile} onPress={() => start('beitrag', k)} accessibilityRole="button" accessibilityLabel={KIND_INFO[k].title}>
                  <View style={[st.tileIcon, { borderColor: KIND_INFO[k].color }]}><Icon name={`${POST_KINDS[k].icon}-outline` as IconName} size={20} color={KIND_INFO[k].color} /></View>
                  <Text style={st.tileTitle}>{KIND_INFO[k].title}</Text>
                  <Text style={st.tileHint}>{KIND_INFO[k].hint}</Text>
                </PressScale>
              ))}
            </View>
          </FadeIn>
        )}
      </ScrollView>
    )
  }

  const heading = isReel ? 'Neues Reel' : remixOf ? 'Nachgemixt' : KIND_INFO[kind].title
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.topRow}>
          <Pressable onPress={() => setMode(null)} hitSlop={12} style={st.back} accessibilityRole="button" accessibilityLabel="Zurück zur Auswahl">
            <Icon name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={st.formTitle}>{heading}</Text>
          <View style={{ width: 34 }} />
        </View>

        <FadeIn distance={10} duration={380} style={{ gap: 14 }}>
        {groupId && group.data && <Text style={st.context}>Beitrag im Raum {group.data.emoji} {group.data.name}</Text>}
        {remixOf && remixPost.data && <Text style={st.context}>↻ Deine Version von „{remixPost.data.title ?? remixPost.data.body.slice(0, 40)}“ von {remixPost.data.author_name}</Text>}

        {isCheckin && (
          <View style={st.group}>
            <View style={[st.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
              <Text style={st.rowLabel}>Wie war’s?</Text>
              <DropRating value={rating} size={34} onChange={setRating} />
            </View>
            <View style={st.sep} />
            {product ? (
              <Pressable style={st.row} onPress={() => setProduct(null)} accessibilityLabel={`Produkt entfernen: ${product.name}`}>
                <Icon name="wine-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={st.rowText} numberOfLines={1}>{product.name}</Text>
                  {!!product.brand_name && <Text style={{ color: colors.muted, fontSize: 12 }}>{product.brand_name}</Text>}
                </View>
                <Icon name="close-circle-outline" size={20} color={colors.faint} />
              </Pressable>
            ) : (
              <Pressable style={st.row} onPress={async () => { const pr = await productPicker.open(); if (pr) { setProduct(pr); setCategory(pr.category) } }} accessibilityRole="button">
                <Icon name="wine-outline" size={20} color={colors.accent} />
                <Text style={[st.rowText, { flex: 1 }]}>Flasche oder Drink markieren</Text>
                <Icon name="chevron-forward" size={16} color={colors.faint} />
              </Pressable>
            )}
            <View style={st.sep} />
            <View style={[st.row, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <Text style={st.rowLabel}>Aromen</Text>
              <AromaChips aromas={AROMAS} selected={aromas} onToggle={a => setAromas(x => x.includes(a) ? x.filter(y => y !== a) : [...x, a].slice(0, 6))} />
            </View>
          </View>
        )}
        {isReel ? (
          video ? (
            <View style={st.videoBox}>
              <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
              <Pressable onPress={() => setVideo(null)} style={st.remove} accessibilityLabel="Video entfernen"><Icon name="close" size={18} color="#fff" /></Pressable>
            </View>
          ) : (
            <View style={st.pickBox}>
              <Icon name="film-outline" size={40} color={colors.accent} />
              <Text style={st.pickTitle}>Video für dein Reel</Text>
              <Text style={st.pickText}>Hochformat, bis 60 Sekunden</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                {Platform.OS !== 'web' && <Button title="Aufnehmen" icon="videocam-outline" variant="secondary" onPress={() => pickVideo(true)} />}
                <Button title="Auswählen" icon="images-outline" onPress={() => pickVideo(false)} />
              </View>
            </View>
          )
        ) : images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {images.map((img, i) => (
              <View key={img.uri + i}>
                <Image source={{ uri: img.uri }} style={st.thumb} contentFit="cover" />
                <Pressable onPress={() => setImages(images.filter((_, j) => j !== i))} style={st.remove} accessibilityLabel={`Bild ${i + 1} entfernen`}><Icon name="close" size={16} color="#fff" /></Pressable>
                {i === 0 && <View style={st.coverTag}><Text style={st.coverText}>Titelbild</Text></View>}
              </View>
            ))}
            {images.length < 10 && (
              <Pressable style={[st.thumb, st.addThumb]} onPress={() => addImages(false)} accessibilityLabel="Weitere Fotos hinzufügen">
                <Icon name="add" size={30} color={colors.accent} />
              </Pressable>
            )}
          </ScrollView>
        ) : (
          <View style={st.pickBox}>
            <Icon name="images-outline" size={36} color={colors.accent} />
            <Text style={st.pickTitle}>Fotos hinzufügen</Text>
            <Text style={st.pickText}>Bis zu 10 Bilder, mit Filtern{kind === 'beitrag' && !remixOf ? '' : ' (optional)'}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              {Platform.OS !== 'web' && <Button title="Kamera" icon="camera-outline" variant="secondary" onPress={() => addImages(true)} />}
              <Button title="Fotos (bis 10)" icon="images-outline" onPress={() => addImages(false)} />
            </View>
          </View>
        )}

        {!isReel && !images.length && ['neuheit', 'angebot', 'event'].includes(kind) && (
          <View style={{ gap: 10 }}>
            <Text style={st.rowLabel}>Ohne Foto? Als gestaltete Vorlage teilen</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {TEMPLATES.map(t => <Chip key={t.key} label={t.label} active={template === t.key} onPress={() => setTemplate(template === t.key ? null : t.key)} />)}
            </View>
            {template && <TemplateCard template={template} title={title || 'Dein Titel'} body={body || 'Dein Text erscheint hier.'} author={profile.name} />}
          </View>
        )}

        {!isReel && (kind !== 'beitrag' || title) && kind !== 'checkin' ? <Field label={needsTitle ? 'Titel' : undefined} value={title} onChangeText={setTitle} placeholder={TITLE_HINT[kind]} maxLength={140} /> : null}

        {isRecipe && (
          <View style={st.group}>
            <View style={[st.row, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
              <Text style={st.rowLabel}>Zutaten</Text>
              {ingredients.map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={{ flex: 2 }}><Field value={ing.name} onChangeText={t => setIngredients(x => x.map((y, j) => j === i ? { ...y, name: t } : y))} placeholder={i === 0 ? 'z. B. Gin' : 'Zutat'} /></View>
                  <View style={{ flex: 1 }}><Field value={ing.amount} onChangeText={t => setIngredients(x => x.map((y, j) => j === i ? { ...y, amount: t } : y))} placeholder="30 ml" /></View>
                </View>
              ))}
              <Pressable onPress={() => setIngredients(x => [...x, { name: '', amount: '' }])} style={st.addRow} accessibilityRole="button"><Icon name="add" size={18} color={colors.accent} /><Text style={st.addText}>Zutat hinzufügen</Text></Pressable>
            </View>
            <View style={st.sep} />
            <View style={[st.row, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
              <Text style={st.rowLabel}>Schritte</Text>
              {steps.map((stp, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={st.stepNo}>{i + 1}</Text>
                  <View style={{ flex: 1 }}><Field value={stp} onChangeText={t => setSteps(x => x.map((y, j) => j === i ? t : y))} placeholder={i === 0 ? 'z. B. Auf Eis 20 Sekunden rühren' : 'Nächster Schritt'} /></View>
                </View>
              ))}
              <Pressable onPress={() => setSteps(x => [...x, ''])} style={st.addRow} accessibilityRole="button"><Icon name="add" size={18} color={colors.accent} /><Text style={st.addText}>Schritt hinzufügen</Text></Pressable>
            </View>
          </View>
        )}

        <View>
          <Field value={body} onChangeText={setBody} multiline placeholder={isCheckin ? 'Wie schmeckt es? Mit wem, wo, warum …' : isReel ? 'Bildunterschrift … #hashtags @erwähnen' : kind === 'job' ? 'Aufgaben, Anforderungen, wie man sich bewirbt …' : 'Schreib etwas dazu … #hashtags @erwähnen'} maxLength={3000} />
          <MentionSuggest text={body} onChange={setBody} />
        </View>

        <View style={st.group}>
          {music ? (
            <View style={st.row}>
              <MusicCover track={music} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={st.rowText} numberOfLines={1}>{music.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{music.artist}</Text>
              </View>
              <Pressable onPress={() => setMusic(null)} hitSlop={10} accessibilityLabel="Musik entfernen"><Icon name="close-circle-outline" size={20} color={colors.faint} /></Pressable>
            </View>
          ) : (
            <Pressable style={st.row} onPress={async () => { const t = await musicPicker.open(); if (t) setMusic(t) }} accessibilityRole="button">
              <Icon name="musical-notes-outline" size={20} color={colors.accent} />
              <Text style={[st.rowText, { flex: 1 }]}>Musik hinzufügen</Text>
              <Icon name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          )}
          <View style={st.sep} />
          {chosenVenue ? (
            <Pressable style={st.row} onPress={() => setVenueId(null)} accessibilityLabel={`Ort entfernen: ${chosenVenue.name}`}>
              <Icon name="location-outline" size={20} color={colors.accent} />
              <Text style={[st.rowText, { flex: 1 }]} numberOfLines={1}>{chosenVenue.name}, {chosenVenue.city}</Text>
              <Icon name="close-circle-outline" size={20} color={colors.faint} />
            </Pressable>
          ) : (
            <Pressable style={st.row} onPress={async () => { const v = await venuePicker.open(); if (v) setVenueId(v.id) }} accessibilityRole="button">
              <Icon name="location-outline" size={20} color={colors.accent} />
              <Text style={[st.rowText, { flex: 1 }]}>Ort hinzufügen</Text>
              <Icon name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          )}
          {business && !isReel && !groupId && (
            <>
              <View style={st.sep} />
              {collab ? (
                <Pressable style={st.row} onPress={() => setCollab(null)} accessibilityLabel={`Kollaboration entfernen: ${collab.name}`}>
                  <Icon name="people-outline" size={20} color={colors.accent} />
                  <Text style={[st.rowText, { flex: 1 }]} numberOfLines={1}>Gemeinsam mit {collab.name}</Text>
                  <Icon name="close-circle-outline" size={20} color={colors.faint} />
                </Pressable>
              ) : (
                <Pressable style={st.row} onPress={async () => { const p = await personPicker.open(); if (p) setCollab(p) }} accessibilityRole="button">
                  <Icon name="people-outline" size={20} color={colors.accent} />
                  <Text style={[st.rowText, { flex: 1 }]}>Gemeinsam posten (Kollaboration)</Text>
                  <Icon name="chevron-forward" size={16} color={colors.faint} />
                </Pressable>
              )}
            </>
          )}
          {kind === 'job' && (
            <>
              <View style={st.sep} />
              <Pressable style={st.row} onPress={() => { tap('select'); setUrgent(!urgent) }} accessibilityRole="switch" accessibilityState={{ checked: urgent }}>
                <Icon name="time-outline" size={20} color={urgent ? colors.heart : colors.accent} />
                <Text style={[st.rowText, { flex: 1 }]}>Dringend: Schichtvertretung für heute</Text>
                <View style={[st.toggle, urgent && st.toggleOn]}><View style={[st.knob, urgent && { alignSelf: 'flex-end' }]} /></View>
              </Pressable>
            </>
          )}
          <View style={st.sep} />
          <View style={[st.row, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <Text style={st.rowLabel}>Kategorie</Text>
            <View style={st.wrap}>
              {(Object.keys(CATEGORIES) as Category[]).map(c => <Chip key={c} label={CATEGORIES[c]} active={category === c} onPress={() => setCategory(c)} />)}
            </View>
          </View>
          {!isReel && kind !== 'beitrag' && (
            <>
              <View style={st.sep} />
              <View style={[st.row, { paddingVertical: 4 }]}>
                <Icon name="link" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}><Field value={link} onChangeText={setLink} placeholder="Link (optional), z. B. www.beispiel.de" autoCapitalize="none" keyboardType="url" /></View>
              </View>
            </>
          )}
        </View>

        <Button title={create.isPending ? 'Wird hochgeladen …' : isReel ? 'Reel teilen' : isCheckin ? 'Einchecken' : 'Teilen'} icon="send" onPress={submit} loading={create.isPending} disabled={!canPost} style={{ marginTop: 4 }} />
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  h1: { color: colors.text, fontFamily: fonts.serif, fontSize: 28, fontWeight: '700', marginTop: 6 },
  lead: { color: colors.muted, fontSize: 15, marginTop: 6, marginBottom: 6 },
  bigCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bigIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(227,165,133,0.45)', backgroundColor: 'rgba(227,165,133,0.08)', alignItems: 'center', justifyContent: 'center' },
  bigTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  bigHint: { color: colors.muted, fontSize: 13, marginTop: 3 },
  groupLabel: { color: colors.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 12, marginBottom: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  tileIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  tileHint: { color: colors.muted, fontSize: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  formTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  group: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowText: { color: colors.text, fontSize: 15 },
  rowLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  context: { color: colors.accentLight, fontSize: 13, fontWeight: '600', padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(227,165,133,0.1)' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  addText: { color: colors.accent, fontWeight: '600' },
  stepNo: { color: colors.accent, fontWeight: '800', width: 16, textAlign: 'center' },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.surface2, padding: 3, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.heart, borderColor: colors.heart },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 46 },
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
})
