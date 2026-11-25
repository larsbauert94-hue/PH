import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useCollection, useCollectionActions, useCollectionItems, useProfiles } from '../../lib/queries'
import { useMe } from '../../lib/auth'
import { personPicker } from '../../lib/picker'
import { VENUE_TYPES } from '../../lib/labels'
import { colors, fonts, radius } from '../../lib/theme'
import PostCard from '../../components/PostCard'
import { Icon } from '../../components/Icon'
import { Avatar, Empty, Loading } from '../../components/ui'
import { confirmAction, notify } from '../../components/report'

/** Sammlung mit Beiträgen und Orten; Mitglieder können gemeinsam hinzufügen */
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { me } = useMe()
  const c = useCollection(id)
  const items = useCollectionItems(id)
  const people = useProfiles()
  const actions = useCollectionActions()

  if (c.isPending) return <Loading />
  if (!c.data) return <Empty icon="albums-outline" text="Diese Sammlung gibt es nicht oder sie ist privat." />
  const col = c.data
  const members = [col.owner_id, ...col.member_ids].map(m => people.data?.find(p => p.id === m)).filter(Boolean)
  const invite = async () => {
    const p = await personPicker.open()
    if (p) actions.addMember(id, p.id).then(() => notify('Eingeladen', `${p.name} kann jetzt mitsammeln.`)).catch(e => notify('Fehler', e.message))
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Text style={st.name}>{col.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          {members.map((p, i) => <View key={p!.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar name={p!.name} url={p!.avatar_url} type={p!.account_type} size={30} /></View>)}
        </View>
        <Text style={st.meta}>{members.length === 1 ? 'Nur du' : `${members.length} Personen sammeln mit`}</Text>
        {col.owner_id === me && (
          <Pressable onPress={invite} style={st.invite} accessibilityRole="button">
            <Icon name="person-add-outline" size={16} color={colors.onAccent} />
            <Text style={st.inviteText}>Einladen</Text>
          </Pressable>
        )}
      </View>
    </View>
  )

  return (
    <>
      <Stack.Screen options={{
        title: col.name,
        headerRight: col.owner_id === me ? () => (
          <Pressable onPress={() => confirmAction('Sammlung löschen?', 'Die Einträge selbst bleiben erhalten.', 'Löschen', () => actions.remove(id).then(() => router.back()))} hitSlop={10} style={{ marginRight: 12 }} accessibilityLabel="Sammlung löschen">
            <Icon name="trash-outline" size={20} color={colors.muted} />
          </Pressable>
        ) : undefined,
      }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={items.data ?? []}
        keyExtractor={i => i.id}
        ListHeaderComponent={header}
        ListEmptyComponent={items.isPending ? <Loading /> : <Empty icon="bookmark-outline" text="Noch leer. Füge Beiträge über „•••“ oder Orte über „Merken“ hinzu." />}
        contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        renderItem={({ item }) => item.post ? <PostCard post={item.post} /> : (
          <Pressable style={st.venue} onPress={() => router.push(`/ort/${item.venue!.id}`)} onLongPress={() => actions.removeItem(item.id)}>
            <View style={[st.dot, { backgroundColor: VENUE_TYPES[item.venue!.type].color }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.venueName}>{item.venue!.name}</Text>
              <Text style={st.meta}>{VENUE_TYPES[item.venue!.type].label} · {item.venue!.city}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        )}
      />
    </>
  )
}

const st = StyleSheet.create({
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 26, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
  invite: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.pill, backgroundColor: colors.accent },
  inviteText: { color: colors.onAccent, fontWeight: '700' },
  venue: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface },
  dot: { width: 10, height: 10, borderRadius: 5 },
  venueName: { color: colors.text, fontWeight: '700', fontSize: 15 },
})
