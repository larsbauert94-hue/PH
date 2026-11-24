import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMusicSearch } from '../../lib/queries'
import { musicPicker } from '../../lib/picker'
import { isDemo } from '../../lib/supabase'
import { colors, radius } from '../../lib/theme'
import type { Track } from '../../lib/types'
import { MusicCover } from '../../components/music'
import { Empty, ErrorView, Loading } from '../../components/ui'

export default function MusicPicker() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t) }, [q])
  // Bei Verlassen ohne Auswahl: Abbruch
  useEffect(() => () => musicPicker.finish(null), [])
  // Ohne Suchbegriff Vorschläge zeigen (im Demo-Modus alle Beispiel-Songs)
  const music = useMusicSearch(debounced || (isDemo ? '' : 'Top Hits Deutschland'))

  const choose = (t: Track) => { musicPicker.finish(t); router.back() }

  return (
    <View style={st.root}>
      <View style={st.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Songs oder Künstler:innen suchen" placeholderTextColor={colors.faint} style={st.input} autoFocus autoCorrect={false} />
      </View>
      <Text style={st.hint}>Suche über Spotify. Ein Tipp auf den Song im Beitrag öffnet ihn in Spotify.</Text>
      {music.isPending ? <Loading /> : music.isError ? <ErrorView error={music.error} onRetry={music.refetch} /> : (
        <FlatList
          data={music.data}
          keyExtractor={t => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<Empty icon="musical-notes-outline" text="Keine Songs gefunden." />}
          renderItem={({ item: t }) => (
            <Pressable style={st.row} onPress={() => choose(t)} accessibilityLabel={`${t.title} von ${t.artist} auswählen`}>
              <MusicCover track={t} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={st.title} numberOfLines={1}>{t.title}</Text>
                <Text style={st.artist} numberOfLines={1}>{t.artist}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 12, height: 44 },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  hint: { color: colors.faint, fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  artist: { color: colors.muted, fontSize: 13 },
})
