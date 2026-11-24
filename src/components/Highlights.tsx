import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useDeleteHighlight, useHighlights } from '../lib/queries'
import { colors } from '../lib/theme'
import { confirmAction } from './report'

/** Highlight-Kreise unter der Bio (wie bei Instagram) */
export default function Highlights({ ownerId, isMe }: { ownerId: string; isMe: boolean }) {
  const highlights = useHighlights(ownerId)
  const del = useDeleteHighlight()
  const list = highlights.data ?? []
  if (!isMe && !list.length) return null

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
      {list.map(h => (
        <Pressable
          key={h.id}
          style={st.item}
          onPress={() => router.push({ pathname: '/highlight/[id]', params: { id: h.id, owner: ownerId } })}
          onLongPress={isMe ? () => confirmAction(`„${h.title}“ löschen?`, 'Die Storys selbst bleiben in deinem Archiv.', 'Löschen', () => del.mutate(h.id)) : undefined}
          accessibilityLabel={`Highlight ${h.title}`}
        >
          <View style={st.ring}>
            {h.cover_url ? <Image source={{ uri: h.cover_url }} style={st.cover} contentFit="cover" /> : <View style={[st.cover, { backgroundColor: colors.surface2 }]} />}
          </View>
          <Text style={st.label} numberOfLines={1}>{h.title}</Text>
        </Pressable>
      ))}
      {isMe && (
        <Pressable style={st.item} onPress={() => router.push('/highlight/neu')} accessibilityLabel="Neues Highlight">
          <View style={[st.ring, st.newRing]}><Ionicons name="add" size={30} color={colors.text} /></View>
          <Text style={st.label}>Neu</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  row: { gap: 16, paddingHorizontal: 16, paddingBottom: 14 },
  item: { alignItems: 'center', gap: 6, width: 68 },
  ring: { width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, borderColor: colors.border, padding: 3, alignItems: 'center', justifyContent: 'center' },
  newRing: { borderStyle: 'dashed', borderColor: colors.faint },
  cover: { width: 56, height: 56, borderRadius: 28 },
  label: { color: colors.text, fontSize: 12, maxWidth: 68 },
})
