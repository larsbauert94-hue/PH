import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCollectionActions, useCollections } from '../../lib/queries'
import { colors, radius } from '../../lib/theme'
import { Icon } from '../../components/Icon'
import { Button, Field, Loading } from '../../components/ui'
import { notify } from '../../components/report'
import { tap } from '../../components/motion'

/** Beitrag oder Ort zu einer Sammlung hinzufügen (oder neue anlegen) */
export default function AddToCollection() {
  const { post, venue } = useLocalSearchParams<{ post?: string; venue?: string }>()
  const list = useCollections()
  const actions = useCollectionActions()
  const [name, setName] = useState('')
  const target = { postId: post, venueId: venue }

  const add = (id: string, label: string) => actions.add(id, target)
    .then(() => { tap('medium'); notify('Hinzugefügt', `In „${label}“ gespeichert.`); router.back() })
    .catch(e => notify('Fehler', e.message))
  const createAndAdd = () => actions.create(name.trim()).then(id => add(id, name.trim())).catch(e => notify('Fehler', e.message))

  if (list.isPending) return <Loading />
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={list.data ?? []}
      keyExtractor={c => c.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      renderItem={({ item: c }) => (
        <Pressable style={st.row} onPress={() => add(c.id, c.name)} accessibilityLabel={`Zu ${c.name} hinzufügen`}>
          <Icon name="albums-outline" size={20} color={colors.accent} />
          <Text style={st.name}>{c.name}</Text>
          <Text style={st.meta}>{c.item_count}</Text>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={st.new}>
          <Field value={name} onChangeText={setName} placeholder="Neue Sammlung, z. B. Bars für Wien" maxLength={40} />
          <Button title="Anlegen und hinzufügen" onPress={createAndAdd} disabled={!name.trim()} />
        </View>
      }
    />
  )
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface },
  name: { color: colors.text, fontWeight: '600', flex: 1 },
  meta: { color: colors.muted },
  new: { gap: 10, marginTop: 10 },
})
