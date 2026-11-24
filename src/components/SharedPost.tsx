import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { usePost } from '../lib/queries'
import { colors, radius } from '../lib/theme'
import { Avatar } from './ui'

/** Platzhalter in einer Nachricht, der als Beitragskarte angezeigt wird */
export const sharedPostToken = (id: string) => `[[post:${id}]]`

/** Erkennt den Platzhalter für geteilte Beiträge in einer Nachricht */
export const sharedPostId = (body: string) => body.match(/^\[\[post:([\w-]+)\]\]$/)?.[1] ?? null

/** Vorschaukarte eines geteilten Beitrags im Chat */
export default function SharedPost({ id }: { id: string }) {
  const post = usePost(id)
  const p = post.data
  if (post.isPending) return <View style={[st.card, { height: 120 }]} />
  if (!p) return <View style={st.card}><Text style={st.gone}>Beitrag nicht mehr verfügbar</Text></View>
  return (
    <Pressable style={st.card} onPress={() => p.video_url ? router.navigate({ pathname: '/reels', params: { start: p.id } }) : router.push(`/post/${p.id}`)} accessibilityLabel={`Geteilter Beitrag von ${p.author_name}`}>
      <View style={st.head}>
        <Avatar name={p.author_name} url={p.author_avatar_url} type={p.author_type} size={24} />
        <Text style={st.name} numberOfLines={1}>{p.author_name}</Text>
      </View>
      {p.media[0] && (
        <View>
          <Image source={{ uri: p.media[0] }} style={st.image} contentFit="cover" />
          {p.video_url && <Ionicons name="film" size={20} color="#fff" style={{ position: 'absolute', top: 8, right: 8 }} />}
        </View>
      )}
      <Text style={st.text} numberOfLines={2}>{p.title ?? p.body}</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  card: { width: 230, backgroundColor: colors.surface2, borderRadius: radius.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  name: { color: colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  image: { width: '100%', aspectRatio: 4 / 5 },
  text: { color: colors.text, fontSize: 13, padding: 10 },
  gone: { color: colors.muted, padding: 14, fontSize: 13 },
})
