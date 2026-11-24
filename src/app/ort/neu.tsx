import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import { useMe } from '../../lib/auth'
import { useCreateVenue } from '../../lib/queries'
import { VENUE_TYPES } from '../../lib/labels'
import { colors } from '../../lib/theme'
import type { VenueType } from '../../lib/types'
import { Button, Chip, Field, SectionLabel } from '../../components/ui'
import { notify } from '../../components/report'

export default function NewVenue() {
  const { profile } = useMe()
  const create = useCreateVenue()
  const [name, setName] = useState(profile.name)
  const [type, setType] = useState<VenueType>(profile.account_type === 'restaurant' ? 'restaurant' : 'bar')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState(profile.city)
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState(profile.website ?? '')
  const [phone, setPhone] = useState('')
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const useCurrentLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') throw new Error('Standortzugriff wurde nicht erlaubt.')
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
    } catch (e) {
      notify('Standort', e instanceof Error ? e.message : String(e))
    } finally {
      setLocating(false)
    }
  }

  const submit = async () => {
    let c = coords
    if (!c) {
      // Adresse in Koordinaten umwandeln (nutzt den Geocoder des Geräts)
      try {
        const [hit] = await Location.geocodeAsync(`${address}, ${city}`)
        if (hit) c = { latitude: hit.latitude, longitude: hit.longitude }
      } catch { /* z. B. im Browser nicht verfügbar */ }
    }
    if (!c) { notify('Adresse nicht gefunden', 'Prüfe die Adresse oder nutze „Ich bin gerade vor Ort“.'); return }
    create.mutate({
      name: name.trim(), type, address: address.trim(), city: city.trim(), description: description.trim(),
      website: website.trim() || undefined, phone: phone.trim() || undefined, ...c,
    }, {
      onSuccess: id => router.replace(`/ort/${id}`),
      onError: e => notify('Fehler', e.message),
    })
  }

  const ok = name.trim() && address.trim() && city.trim()

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <Text style={st.text}>Trage deinen Betrieb ein, damit er auf der Karte erscheint und in Beiträgen markiert werden kann.</Text>
        <Field label="Name" value={name} onChangeText={setName} />
        <SectionLabel>Art</SectionLabel>
        <View style={st.wrap}>
          {(Object.keys(VENUE_TYPES) as VenueType[]).map(t => <Chip key={t} label={VENUE_TYPES[t].label} active={type === t} onPress={() => setType(t)} />)}
        </View>
        <Field label="Straße und Hausnummer" value={address} onChangeText={setAddress} placeholder="z. B. Oranienstraße 12" />
        <Field label="Stadt" value={city} onChangeText={setCity} />
        <Button
          title={coords ? 'Standort übernommen ✓' : 'Ich bin gerade vor Ort'}
          icon="locate"
          variant="secondary"
          onPress={useCurrentLocation}
          loading={locating}
        />
        <Field label="Beschreibung" value={description} onChangeText={setDescription} multiline placeholder="Was macht euch aus?" maxLength={1000} />
        <Field label="Website (optional)" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
        <Field label="Telefon (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Eintragen" onPress={submit} loading={create.isPending} disabled={!ok} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
