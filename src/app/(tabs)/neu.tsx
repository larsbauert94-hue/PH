import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '../../lib/auth'
import { useCreatePost, useVenues } from '../../lib/queries'
import { ACCOUNT_TYPES, CATEGORIES, POST_KINDS } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { Category, PostKind } from '../../lib/types'
import { Button, Chip, Field, IconName, SectionLabel } from '../../components/ui'
import { notify } from '../../components/report'

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

  const [kind, setKind] = useState<PostKind>('beitrag')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>('wein')
  const [link, setLink] = useState('')
  const [venueId, setVenueId] = useState<string | null>(null)
  const [image, setImage] = useState<{ uri: string; mime?: string } | null>(null)
  const [venueSearch, setVenueSearch] = useState('')

  const needsTitle = kind !== 'beitrag'
  const canPost = body.trim().length > 0 && (!needsTitle || title.trim().length > 0)

  const pick = async (camera: boolean) => {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) { notify('Kamera', 'Erlaube den Kamerazugriff in den Einstellungen.'); return }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
    if (!res.canceled) setImage({ uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' })
  }

  const reset = () => { setKind('beitrag'); setTitle(''); setBody(''); setLink(''); setVenueId(null); setImage(null); setVenueSearch('') }

  const submit = () => {
    const url = link.trim()
    create.mutate({
      kind, title: title.trim() || undefined, body: body.trim(), category,
      link_url: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : undefined,
      venue_id: venueId ?? undefined, imageUri: image?.uri, imageMime: image?.mime,
    }, {
      onSuccess: () => { reset(); router.navigate('/') },
      onError: e => notify('Fehler beim Posten', e.message),
    })
  }

  const venueMatches = venueSearch.trim()
    ? (venues.data ?? []).filter(v => `${v.name} ${v.city}`.toLowerCase().includes(venueSearch.trim().toLowerCase())).slice(0, 5)
    : []
  const chosenVenue = venues.data?.find(v => v.id === venueId)

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        {kinds.length > 1 && (
          <>
            <SectionLabel>Art des Beitrags</SectionLabel>
            <View style={st.wrap}>
              {kinds.map(k => <Chip key={k} label={POST_KINDS[k].label} icon={POST_KINDS[k].icon as IconName} active={kind === k} onPress={() => setKind(k)} />)}
            </View>
          </>
        )}

        <Field label={needsTitle ? 'Titel' : undefined} value={title} onChangeText={setTitle} placeholder={TITLE_HINT[kind]} maxLength={140} />
        <Field value={body} onChangeText={setBody} multiline placeholder={kind === 'job' ? 'Aufgaben, Anforderungen, wie man sich bewirbt …' : 'Was gibt es Neues?'} maxLength={3000} />

        {image ? (
          <View>
            <Image source={{ uri: image.uri }} style={st.image} contentFit="cover" />
            <Pressable onPress={() => setImage(null)} style={st.remove} accessibilityLabel="Foto entfernen"><Ionicons name="close" size={18} color={colors.text} /></Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Platform.OS !== 'web' && <Button title="Kamera" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick(true)} />}
            <Button title="Foto" icon="image-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick(false)} />
          </View>
        )}

        <SectionLabel>Kategorie</SectionLabel>
        <View style={st.wrap}>
          {(Object.keys(CATEGORIES) as Category[]).map(c => <Chip key={c} label={CATEGORIES[c]} active={category === c} onPress={() => setCategory(c)} />)}
        </View>

        <SectionLabel>Ort markieren (optional)</SectionLabel>
        {chosenVenue ? (
          <Pressable style={st.venue} onPress={() => setVenueId(null)}>
            <Ionicons name="location" size={18} color={colors.amber} />
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

        {kind !== 'beitrag' && <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="www.beispiel.de" autoCapitalize="none" keyboardType="url" />}

        <Button title="Teilen" icon="send" onPress={submit} loading={create.isPending} disabled={!canPost} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  remove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 6 },
  venue: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
})
