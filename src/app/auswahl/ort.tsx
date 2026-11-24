import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useVenues } from '../../lib/queries'
import { venuePicker } from '../../lib/picker'
import { VENUE_TYPES } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import { Empty, Loading } from '../../components/ui'

export default function VenuePicker() {
  const [q, setQ] = useState('')
  const venues = useVenues()
  useEffect(() => () => venuePicker.finish(null), [])
  const n = q.trim().toLowerCase()
  const list = (venues.data ?? []).filter(v => !n || `${v.name} ${v.city}`.toLowerCase().includes(n))

  return (
    <View style={st.root}>
      <View style={st.search}>
        <Ionicons name="location-outline" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Ort suchen" placeholderTextColor={colors.faint} style={st.input} autoFocus />
      </View>
      {venues.isPending ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={v => v.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<Empty icon="location-outline" text="Kein Ort gefunden." />}
          renderItem={({ item: v }) => (
            <Pressable style={st.row} onPress={() => { venuePicker.finish(v); router.back() }}>
              <View style={[st.icon, { backgroundColor: VENUE_TYPES[v.type].color + '22' }]}>
                <Ionicons name={v.type === 'restaurant' ? 'restaurant' : 'wine'} size={18} color={VENUE_TYPES[v.type].color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{v.name}</Text>
                <Text style={st.sub} numberOfLines={1}>{v.address}, {v.city}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 12, height: 44 },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13 },
})
