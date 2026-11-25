import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useCollectionActions, useCollections } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { colors, radius } from '../../lib/theme'
import { Icon } from '../../components/Icon'
import { Button, Empty, Field, Loading } from '../../components/ui'
import { notify } from '../../components/report'

/** Eigene und mit mir geteilte Sammlungen */
export default function Collections() {
  const { me } = useMe()
  const list = useCollections()
  const actions = useCollectionActions()
  const [name, setName] = useState('')

  const create = () => actions.create(name.trim()).then(id => { setName(''); router.push(`/sammlungen/${id}`) }).catch(e => notify('Fehler', e.message))

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={list.data ?? []}
      keyExtractor={c => c.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' }}
      ListHeaderComponent={
        <View style={st.new}>
          <Text style={st.newTitle}>Neue Sammlung</Text>
          <Field value={name} onChangeText={setName} placeholder="z. B. Bars für Wien" maxLength={40} />
          <Button title="Anlegen" icon="add" onPress={create} disabled={!name.trim()} />
        </View>
      }
      ListEmptyComponent={list.isPending ? <Loading /> : <Empty icon="albums-outline" text="Noch keine Sammlungen. Leg eine an und lade Freunde ein, gemeinsam Orte und Beiträge zu sammeln." />}
      renderItem={({ item: c }) => (
        <Pressable style={st.card} onPress={() => router.push(`/sammlungen/${c.id}`)} accessibilityLabel={`Sammlung ${c.name}`}>
          <View style={st.cover}>
            {c.cover_url ? <Image source={{ uri: c.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="albums-outline" size={30} color={colors.accent} />}
          </View>
          <Text style={st.name} numberOfLines={1}>{c.name}</Text>
          <Text style={st.meta}>{c.item_count} Einträge{c.member_ids.length ? ` · mit ${c.member_ids.length} ${c.member_ids.length === 1 ? 'Person' : 'Personen'}` : ''}{c.owner_id !== me ? ' · geteilt' : ''}</Text>
        </Pressable>
      )}
    />
  )
}

const st = StyleSheet.create({
  new: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  newTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  card: { flex: 1, gap: 6, maxWidth: '50%' },
  cover: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
})
