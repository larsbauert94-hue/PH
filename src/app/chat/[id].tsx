import { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../../lib/auth'
import { useConversations, useMarkConversationRead, useMessages, useSendMessage } from '../../lib/queries'
import { colors, radius } from '../../lib/theme'
import type { Message } from '../../lib/types'
import { Avatar, ErrorView, Loading } from '../../components/ui'
import SharedPost, { sharedPostId } from '../../components/SharedPost'
import { RichText } from '../../components/media'
import { notify } from '../../components/report'

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Heute'
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern'
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { me } = useMe()
  const insets = useSafeAreaInsets()
  const convs = useConversations()
  const messages = useMessages(id)
  const send = useSendMessage(id)
  const markRead = useMarkConversationRead(id)
  const [text, setText] = useState('')
  const list = useRef<FlatList<Message>>(null)
  const conv = convs.data?.find(c => c.id === id)
  const count = messages.data?.length ?? 0

  // Beim Öffnen und bei neuen Nachrichten als gelesen markieren
  const { mutate: markReadNow } = markRead
  useEffect(() => { if (count) markReadNow() }, [count, markReadNow])

  const submit = () => {
    const body = text.trim()
    if (!body) return
    setText('')
    send.mutate(body, { onError: e => { setText(body); notify('Nicht gesendet', e.message) } })
  }

  const title = conv ? (
    <Pressable onPress={() => router.push(`/profil/${conv.other_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Avatar name={conv.other_name} url={conv.other_avatar_url} type={conv.other_type} size={32} />
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{conv.other_name}</Text>
    </Pressable>
  ) : null

  // Nachrichten neueste zuerst für die umgedrehte Liste
  const data = [...(messages.data ?? [])].reverse()

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ headerTitle: () => title }} />
      {messages.isPending ? <Loading /> : messages.isError ? <ErrorView error={messages.error} onRetry={messages.refetch} /> : (
        <FlatList
          ref={list}
          inverted
          data={data}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 6, maxWidth: 680, width: '100%', alignSelf: 'center' }}
          ListFooterComponent={conv && !data.length ? <Text style={st.hint}>Schreib {conv.other_name.split(' ')[0]} die erste Nachricht.</Text> : undefined}
          renderItem={({ item: m, index }) => {
            const mine = m.sender_id === me
            const older = data[index + 1]
            const newDay = !older || new Date(older.created_at).toDateString() !== new Date(m.created_at).toDateString()
            return (
              <View>
                {newDay && <Text style={st.day}>{dayLabel(m.created_at)}</Text>}
                {sharedPostId(m.body) ? (
                  <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}><SharedPost id={sharedPostId(m.body)!} /></View>
                ) : (
                  <View style={[st.bubble, mine ? st.mine : st.theirs]}>
                    <RichText text={m.body} style={[st.text, mine && { color: colors.onAccent }]} />
                    <Text style={[st.clock, mine && { color: 'rgba(11,16,41,0.6)' }]}>{clock(m.created_at)}</Text>
                  </View>
                )}
              </View>
            )
          }}
        />
      )}
      {conv?.blocked ? (
        <Text style={[st.blocked, { paddingBottom: insets.bottom + 12 }]}>Mit diesem Profil ist kein Kontakt mehr möglich.</Text>
      ) : (
        <View style={[st.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput value={text} onChangeText={setText} placeholder="Nachricht schreiben …" placeholderTextColor={colors.faint} style={st.input} multiline maxLength={2000} />
          <Pressable onPress={submit} disabled={!text.trim()} style={[st.send, !text.trim() && { opacity: 0.4 }]} accessibilityLabel="Senden">
            <Ionicons name="arrow-up" size={22} color={colors.onAccent} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  day: { color: colors.faint, fontSize: 12, textAlign: 'center', marginVertical: 10 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderBottomLeftRadius: 6 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  clock: { color: colors.faint, fontSize: 11, alignSelf: 'flex-end' },
  hint: { color: colors.muted, textAlign: 'center', padding: 24 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, color: colors.text, fontSize: 16, backgroundColor: colors.surface2, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 140 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  blocked: { color: colors.muted, textAlign: 'center', paddingTop: 12 },
})
