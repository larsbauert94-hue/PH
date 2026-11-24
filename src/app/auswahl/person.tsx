import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Icon } from '../../components/Icon'
import { useMe } from '../../lib/auth'
import { useProfiles } from '../../lib/queries'
import { personPicker } from '../../lib/picker'
import { subtitle } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import { Avatar, Empty, Loading } from '../../components/ui'

export default function PersonPicker() {
  const { me } = useMe()
  const [q, setQ] = useState('')
  const profiles = useProfiles(undefined, q.trim() || undefined)
  useEffect(() => () => personPicker.finish(null), [])
  const list = (profiles.data ?? []).filter(p => p.id !== me)

  return (
    <View style={st.root}>
      <View style={st.search}>
        <Icon name="at" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Person oder Betrieb suchen" placeholderTextColor={colors.faint} style={st.input} autoFocus autoCapitalize="none" />
      </View>
      {profiles.isPending ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={p => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={<Empty icon="people-outline" text="Niemand gefunden." />}
          renderItem={({ item: p }) => (
            <Pressable style={st.row} onPress={() => { personPicker.finish(p); router.back() }}>
              <Avatar name={p.name} url={p.avatar_url} type={p.account_type} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{p.name}</Text>
                <Text style={st.sub} numberOfLines={1}>@{p.handle} · {subtitle(p)}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13 },
})
