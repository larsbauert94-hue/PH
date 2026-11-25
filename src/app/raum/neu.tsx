import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useCreateGroup } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { colors, radius } from '../../lib/theme'
import { Button, Field } from '../../components/ui'
import { notify } from '../../components/report'

const EMOJIS = ['🍷', '🍸', '🥃', '🍺', '🥂', '🌿', '🍋', '🧊', '🍾', '🔥']

/** Raum gründen; mit Startzeit wird daraus ein Live-Tasting */
export default function NewGroup() {
  const { profile } = useMe()
  const create = useCreateGroup()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState(profile.city)
  const [emoji, setEmoji] = useState('🍷')
  const [tasting, setTasting] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')

  const submit = () => {
    let starts_at: string | undefined
    if (tasting) {
      const d = new Date(`${date}T${time}:00`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(d.getTime())) { notify('Termin', 'Bitte das Datum als JJJJ-MM-TT und die Uhrzeit als HH:MM eingeben.'); return }
      starts_at = d.toISOString()
    }
    create.mutate({ name: name.trim(), description: description.trim(), city: city.trim(), emoji, starts_at }, {
      onSuccess: id => router.replace(`/raum/${id}`),
      onError: e => notify('Fehler', e.message),
    })
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.emojis}>
          {EMOJIS.map(e => (
            <Pressable key={e} onPress={() => setEmoji(e)} style={[st.emoji, emoji === e && st.emojiOn]} accessibilityLabel={`Symbol ${e}`}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Bar-Szene Hamburg" maxLength={60} />
        <Field label="Worum geht’s?" value={description} onChangeText={setDescription} multiline maxLength={500} />
        <Field label="Stadt (optional)" value={city} onChangeText={setCity} />
        <Pressable style={[st.toggle, tasting && st.toggleOn]} onPress={() => setTasting(!tasting)} accessibilityRole="switch" accessibilityState={{ checked: tasting }}>
          <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>Live-Tasting mit Startzeit</Text>
          <Text style={{ color: tasting ? colors.accent : colors.muted, fontWeight: '700' }}>{tasting ? 'Ja' : 'Nein'}</Text>
        </Pressable>
        {tasting && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 2 }}><Field label="Datum" value={date} onChangeText={setDate} placeholder="2026-12-05" autoCapitalize="none" /></View>
            <View style={{ flex: 1 }}><Field label="Uhrzeit" value={time} onChangeText={setTime} placeholder="19:00" /></View>
          </View>
        )}
        <Button title="Raum gründen" onPress={submit} loading={create.isPending} disabled={name.trim().length < 3} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emojiOn: { borderColor: colors.accent, backgroundColor: 'rgba(227,165,133,0.15)' },
  toggle: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleOn: { borderColor: colors.accent },
})
