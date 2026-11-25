import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { colors, radius } from '../lib/theme'
import { Button, Field } from '../components/ui'
import { notify } from '../components/report'
import { tap } from '../components/motion'

const lines = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean)
const tags = (t: string) => t.split(',').map(x => x.trim()).filter(Boolean)

/** Lebenslauf bearbeiten: Stationen, Zertifikate, Fähigkeiten, „offen für Jobs“ */
export default function CVScreen() {
  const { profile, refreshProfile } = useAuth()
  const [stations, setStations] = useState((profile?.stations ?? []).join('\n'))
  const [certs, setCerts] = useState((profile?.certificates ?? []).join(', '))
  const [skills, setSkills] = useState((profile?.skills ?? []).join(', '))
  const [open, setOpen] = useState(!!profile?.open_to_work)
  const [from, setFrom] = useState(profile?.available_from ?? '')
  const [busy, setBusy] = useState(false)
  if (!profile) return null

  const save = async () => {
    const date = from.trim()
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { notify('Datum', 'Bitte als JJJJ-MM-TT eingeben, z. B. 2027-01-15.'); return }
    setBusy(true)
    try {
      await api.updateProfile(profile.id, { stations: lines(stations), certificates: tags(certs), skills: tags(skills), open_to_work: open, available_from: date || null })
      await refreshProfile()
      router.back()
    } catch (e) { notify('Fehler', e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <Pressable style={[st.toggleRow, open && st.toggleRowOn]} onPress={() => { tap('select'); setOpen(!open) }} accessibilityRole="switch" accessibilityState={{ checked: open }}>
          <View style={{ flex: 1 }}>
            <Text style={st.toggleTitle}>Offen für Jobs</Text>
            <Text style={st.toggleText}>Betriebe in deiner Stadt sehen das, und du bekommst passende Stellen als Mitteilung.</Text>
          </View>
          <View style={[st.toggle, open && st.toggleOn]}><View style={[st.knob, open && { alignSelf: 'flex-end' }]} /></View>
        </Pressable>
        {open && <Field label="Verfügbar ab (optional)" value={from} onChangeText={setFrom} placeholder="JJJJ-MM-TT" autoCapitalize="none" />}
        <Field label="Stationen (eine pro Zeile)" value={stations} onChangeText={setStations} multiline placeholder={'Bar Nachtschatten, Berlin · seit 2022\nHotelbar Residenz · 2019–2022'} />
        <Field label="Zertifikate (mit Komma getrennt)" value={certs} onChangeText={setCerts} placeholder="WSET Level 3, Barkeeper IHK" />
        <Field label="Fähigkeiten (mit Komma getrennt)" value={skills} onChangeText={setSkills} placeholder="Klassiker, Weinbegleitung, Speed-Service" />
        <Button title="Speichern" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleRowOn: { borderColor: '#6cc596' },
  toggleTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  toggleText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  toggle: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.surface2, padding: 3, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: '#6cc596', borderColor: '#6cc596' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
})
