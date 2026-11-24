import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useCreateHighlight, useStoryArchive } from '../../lib/queries'
import { colors } from '../../lib/theme'
import { Button, Empty, Field, Loading } from '../../components/ui'
import { notify } from '../../components/report'

/** Highlight aus eigenen (auch abgelaufenen) Storys zusammenstellen */
export default function NewHighlight() {
  const archive = useStoryArchive()
  const create = useCreateHighlight()
  const { width } = useWindowDimensions()
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const cell = (Math.min(width, 680) - 4) / 3

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const save = () => {
    const stories = archive.data ?? []
    const cover = stories.find(s => s.id === selected[0])?.media_url ?? null
    create.mutate({ title: title.trim(), storyIds: selected, coverUrl: cover }, {
      onSuccess: () => router.back(),
      onError: e => notify('Fehler', e.message),
    })
  }

  if (archive.isPending) return <Loading />
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 120 }}>
        <View style={{ padding: 16, gap: 8 }}>
          <Field value={title} onChangeText={setTitle} placeholder="Name, z. B. „Cocktails“" maxLength={30} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>Wähle Storys aus deinem Archiv. Die erste ist das Titelbild.</Text>
        </View>
        {!archive.data?.length ? <Empty icon="images-outline" text="Du hast noch keine Storys geteilt." /> : (
          <View style={st.grid}>
            {archive.data.map(s => {
              const n = selected.indexOf(s.id)
              return (
                <Pressable key={s.id} onPress={() => toggle(s.id)} style={{ width: cell, height: cell * 16 / 9 }} accessibilityLabel={`Story vom ${new Date(s.created_at).toLocaleDateString('de-DE')}`} accessibilityState={{ selected: n >= 0 }}>
                  <Image source={{ uri: s.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={st.date}><Text style={st.dateText}>{new Date(s.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Text></View>
                  <View style={[st.check, n >= 0 && st.checkOn]}>
                    {n >= 0 && <Text style={st.checkText}>{n + 1}</Text>}
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
      <View style={st.footer}>
        <Button title={selected.length ? `Highlight erstellen (${selected.length})` : 'Storys auswählen'} onPress={save} disabled={!title.trim() || !selected.length} loading={create.isPending} />
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  date: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dateText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  check: { position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: colors.onAccent, fontWeight: '800', fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
