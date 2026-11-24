import { useState } from 'react'
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Icon } from '../../components/Icon'
import * as ExpoLinking from 'expo-linking'
import { useQueryClient } from '@tanstack/react-query'
import { useMe } from '../../lib/auth'
import { api } from '../../lib/api'
import { keys, useConversations, usePost, useProfiles } from '../../lib/queries'
import { subtitle } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { AccountType } from '../../lib/types'
import { Avatar, Loading } from '../../components/ui'
import { notify } from '../../components/report'
import { sharedPostToken } from '../../components/SharedPost'


interface Target { id: string; name: string; sub: string; avatar: string | null; type: AccountType }

/** „Senden an“: Beitrag per Direktnachricht an Kontakte schicken */
export default function ShareSheet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { me } = useMe()
  const qc = useQueryClient()
  const post = usePost(id)
  const convs = useConversations()
  const [q, setQ] = useState('')
  const profiles = useProfiles(undefined, q.trim() || undefined)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const recent: Target[] = (convs.data ?? []).filter(c => !c.blocked).map(c => ({ id: c.other_id, name: c.other_name, sub: subtitle({ account_type: c.other_type, headline: c.other_headline }), avatar: c.other_avatar_url, type: c.other_type }))
  const others: Target[] = (profiles.data ?? []).filter(p => p.id !== me && !recent.some(r => r.id === p.id)).map(p => ({ id: p.id, name: p.name, sub: subtitle(p), avatar: p.avatar_url, type: p.account_type }))
  const list = q.trim() ? [...recent.filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase())), ...others] : [...recent, ...others]

  const send = async (t: Target) => {
    setBusy(t.id)
    try {
      const conv = await api.startConversation(t.id)
      await api.sendMessage(me, conv, sharedPostToken(id))
      if (note.trim()) await api.sendMessage(me, conv, note.trim())
      setSent(s => [...s, t.id])
      qc.invalidateQueries({ queryKey: keys.conversations })
    } catch (e) {
      notify('Nicht gesendet', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const more = () => {
    const p = post.data
    if (!p) return
    Share.share({ message: `${[p.title, p.body].filter(Boolean).join('\n\n')}\n\n– ${p.author_name} auf Pour\n${ExpoLinking.createURL(`/post/${p.id}`)}` }).catch(() => {})
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={st.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Suchen" placeholderTextColor={colors.faint} style={st.input} autoCapitalize="none" />
      </View>
      {convs.isPending ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={t => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          renderItem={({ item: t }) => {
            const done = sent.includes(t.id)
            return (
              <View style={st.row}>
                <Avatar name={t.name} url={t.avatar} type={t.type} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={st.name} numberOfLines={1}>{t.name}</Text>
                  <Text style={st.sub} numberOfLines={1}>{t.sub}</Text>
                </View>
                <Pressable onPress={() => send(t)} disabled={done || busy === t.id} style={[st.btn, done && st.btnDone]} accessibilityLabel={done ? `An ${t.name} gesendet` : `An ${t.name} senden`}>
                  <Text style={[st.btnText, done && { color: colors.text }]}>{done ? 'Gesendet' : busy === t.id ? '…' : 'Senden'}</Text>
                </Pressable>
              </View>
            )
          }}
        />
      )}
      <View style={st.footer}>
        <TextInput value={note} onChangeText={setNote} placeholder="Nachricht hinzufügen …" placeholderTextColor={colors.faint} style={st.note} />
        <Pressable style={st.more} onPress={more} accessibilityLabel="Weitere Möglichkeiten zum Teilen">
          <Icon name="share-outline" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '600' }}>Mehr</Text>
        </Pressable>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 12, height: 42 },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 12 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 92, alignItems: 'center' },
  btnDone: { backgroundColor: colors.surface2 },
  btnText: { color: colors.onAccent, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  note: { flex: 1, color: colors.text, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surface2 },
})
