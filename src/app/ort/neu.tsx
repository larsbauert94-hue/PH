import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { useMe } from '../../lib/auth'
import { useCreateVenue, useUpdateVenue, useVenue } from '../../lib/queries'
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
  const [opens, setOpens] = useState('')
  const [closes, setCloses] = useState('')
  const [happyHour, setHappyHour] = useState('')
  const [reservation, setReservation] = useState('')

  // Bearbeiten eines bestehenden Orts (nur Inhaber)
  const { edit } = useLocalSearchParams<{ edit?: string }>()
  const existing = useVenue(edit ?? '')
  const update = useUpdateVenue(edit ?? '')
  const [loaded, setLoaded] = useState(false)
  if (edit && existing.data && !loaded) {
    const v = existing.data
    setLoaded(true)
    setName(v.name); setType(v.type); setAddress(v.address); setCity(v.city); setDescription(v.description)
    setWebsite(v.website ?? ''); setPhone(v.phone ?? ''); setCoords({ latitude: v.latitude, longitude: v.longitude })
    setOpens(v.opens ?? ''); setCloses(v.closes ?? ''); setHappyHour(v.happy_hour ?? ''); setReservation(v.reservation_url ?? '')
  }
  const time = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t.trim())

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

  const extras = () => ({
    opens: time(opens) ? opens.trim() : undefined,
    closes: time(closes) ? closes.trim() : undefined,
    happy_hour: happyHour.trim(),
    reservation_url: reservation.trim() ? (/^https?:\/\//.test(reservation.trim()) ? reservation.trim() : `https://${reservation.trim()}`) : undefined,
  })

  const submit = async () => {
    if ((opens && !time(opens)) || (closes && !time(closes))) { notify('Öffnungszeiten', 'Bitte als HH:MM eingeben, z. B. 18:00 und 02:00.'); return }
    if (edit) {
      update.mutate({ name: name.trim(), type, description: description.trim(), website: website.trim() || undefined, phone: phone.trim() || undefined, ...extras() }, {
        onSuccess: () => router.back(),
        onError: e => notify('Fehler', e.message),
      })
      return
    }
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
      website: website.trim() || undefined, phone: phone.trim() || undefined, ...c, ...extras(),
    }, {
      onSuccess: id => router.replace(`/ort/${id}`),
      onError: e => notify('Fehler', e.message),
    })
  }

  const ok = name.trim() && address.trim() && city.trim()

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {edit && <Stack.Screen options={{ title: 'Betrieb bearbeiten' }} />}
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
        <SectionLabel>Öffnungszeiten</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Öffnet" value={opens} onChangeText={setOpens} placeholder="18:00" /></View>
          <View style={{ flex: 1 }}><Field label="Schließt" value={closes} onChangeText={setCloses} placeholder="02:00" /></View>
        </View>
        <Field label="Happy Hour (optional)" value={happyHour} onChangeText={setHappyHour} placeholder="z. B. Mo–Do 18–19 Uhr: Klassiker 9 €" />
        <Field label="Link zum Reservieren (optional)" value={reservation} onChangeText={setReservation} autoCapitalize="none" keyboardType="url" />
        <Button title={edit ? 'Speichern' : 'Eintragen'} onPress={submit} loading={create.isPending || update.isPending} disabled={!ok} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 680, width: '100%', alignSelf: 'center' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
