import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth, useMe } from '../lib/auth'
import { api } from '../lib/api'
import { isDemo } from '../lib/supabase'
import { ACCOUNT_TYPES } from '../lib/labels'
import { colors } from '../lib/theme'
import { Avatar, Button, Field, SectionLabel } from '../components/ui'
import { useUploadAvatar } from '../lib/queries'
import { pickImage } from '../lib/pickImage'
import { chooseAction, confirmAction, notify } from '../components/report'

export default function Settings() {
  const { me, profile } = useMe()
  const { refreshProfile, signOut } = useAuth()
  const qc = useQueryClient()
  const person = !ACCOUNT_TYPES[profile.account_type].business
  const [name, setName] = useState(profile.name)
  const [headline, setHeadline] = useState(profile.headline)
  const [workplace, setWorkplace] = useState(profile.workplace)
  const [city, setCity] = useState(profile.city)
  const [bio, setBio] = useState(profile.bio)
  const [website, setWebsite] = useState(profile.website ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const avatar = useUploadAvatar()
  const changePhoto = () => chooseAction('Profilbild', [
    { label: 'Aus Fotos wählen', onPress: async () => { const img = await pickImage({ square: true }); if (img) avatar.mutate(img, { onError: e => notify('Fehler', e.message) }) } },
    { label: 'Foto aufnehmen', onPress: async () => { const img = await pickImage({ square: true, camera: true }); if (img) avatar.mutate(img, { onError: e => notify('Fehler', e.message) }) } },
  ])

  const save = async () => {
    setSaving(true)
    try {
      const w = website.trim()
      await api.updateProfile(me, {
        name: name.trim(), headline: headline.trim(), workplace: workplace.trim(), city: city.trim(), bio: bio.trim(),
        website: w ? (/^https?:\/\//.test(w) ? w : `https://${w}`) : null,
      })
      await refreshProfile()
      qc.invalidateQueries()
      router.back()
    } catch (e) {
      notify('Fehler', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const deleteAccount = () => confirmAction(
    'Account endgültig löschen?',
    'Dein Profil, alle Beiträge, Kommentare, Likes und Bilder werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.',
    'Endgültig löschen',
    async () => {
      setDeleting(true)
      try {
        await api.deleteAccount(me)
        await signOut()
      } catch (e) {
        notify('Fehler', e instanceof Error ? e.message : String(e))
        setDeleting(false)
      }
    },
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <Pressable style={st.photo} onPress={changePhoto} accessibilityRole="button">
          <Avatar name={profile.name} url={profile.avatar_url} type={profile.account_type} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{avatar.isPending ? 'Wird hochgeladen …' : 'Profilbild ändern'}</Text>
            <Text style={st.text}>{person ? 'Ein freundliches Foto von dir' : 'Euer Logo oder ein Foto vom Betrieb'}</Text>
          </View>
        </Pressable>
        <SectionLabel>Profil</SectionLabel>
        <Field label={person ? 'Name' : 'Name des Betriebs'} value={name} onChangeText={setName} />
        {person && <Field label={profile.account_type === 'privat' ? 'Lieblingsgetränke' : 'Position'} value={headline} onChangeText={setHeadline} />}
        {profile.account_type === 'gastro' && <Field label="Arbeitsplatz" value={workplace} onChangeText={setWorkplace} />}
        <Field label="Stadt" value={city} onChangeText={setCity} />
        <Field label="Über mich / uns" value={bio} onChangeText={setBio} multiline maxLength={500} />
        <Field label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="www.beispiel.de" />
        <Button title="Speichern" onPress={save} loading={saving} disabled={!name.trim()} />

        <View style={st.divider} />
        <SectionLabel>Konto</SectionLabel>
        <Text style={st.text}>Kontotyp: {ACCOUNT_TYPES[profile.account_type].label}. Für einen Wechsel oder die Verifizierung deines Betriebs wende dich an den Support.</Text>
        <Button title="Nutzungsbedingungen & Datenschutz" variant="secondary" icon="document-text-outline" onPress={() => router.push('/rechtliches')} />
        <Button title="Abmelden" variant="secondary" icon="log-out-outline" onPress={signOut} />
        <Button title="Account löschen" variant="danger" icon="trash-outline" onPress={deleteAccount} loading={deleting} />
        {isDemo && <Text style={st.demo}>Demo-Modus: Änderungen gehen beim Neustart der App verloren.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48, maxWidth: 680, width: '100%', alignSelf: 'center' },
  text: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  photo: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, borderRadius: 16, backgroundColor: colors.surface, marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  demo: { color: colors.accentLight, fontSize: 12, textAlign: 'center' },
})
