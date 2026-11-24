import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '../lib/auth'
import { useStories } from '../lib/queries'
import { colors } from '../lib/theme'
import type { AccountType } from '../lib/types'
import { Avatar } from './ui'

/** Avatar mit Story-Ring: Roségold-Verlauf = neu, grau = schon gesehen */
export function StoryRing({ name, url, type, size = 66, seen, active = true }: { name: string; url: string | null; type: AccountType; size?: number; seen?: boolean; active?: boolean }) {
  const inner = <View style={[st.gap, { borderRadius: size }]}><Avatar name={name} url={url} type={type} size={size - 8} /></View>
  if (!active) return <View style={{ padding: 3 }}>{inner}</View>
  if (seen) return <View style={[st.seen, { borderRadius: size }]}>{inner}</View>
  return (
    <LinearGradient colors={[colors.roseLight, colors.accent, colors.heart]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ padding: 3, borderRadius: size }}>
      {inner}
    </LinearGradient>
  )
}

/** Leiste mit Storys oben im Feed */
export default function StoryBar() {
  const { me, profile } = useMe()
  const stories = useStories()
  const groups = stories.data ?? []
  const mine = groups.find(g => g.author_id === me)
  const others = groups.filter(g => g.author_id !== me)

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
      <Pressable style={st.item} onPress={() => mine ? router.push(`/story/${me}`) : router.push('/story/neu')} accessibilityLabel={mine ? 'Deine Story ansehen' : 'Story erstellen'}>
        <View>
          <StoryRing name={profile.name} url={profile.avatar_url} type={profile.account_type} active={!!mine} seen={false} />
          <Pressable style={st.plus} onPress={() => router.push('/story/neu')} hitSlop={6} accessibilityLabel="Neue Story">
            <Ionicons name="add" size={16} color={colors.onAccent} />
          </Pressable>
        </View>
        <Text style={st.label} numberOfLines={1}>Deine Story</Text>
      </Pressable>
      {others.map(g => (
        <Pressable key={g.author_id} style={st.item} onPress={() => router.push(`/story/${g.author_id}`)} accessibilityLabel={`Story von ${g.author_name}${g.all_seen ? '' : ', neu'}`}>
          <StoryRing name={g.author_name} url={g.author_avatar_url} type={g.author_type} seen={g.all_seen} />
          <Text style={[st.label, !g.all_seen && { color: colors.text }]} numberOfLines={1}>{g.author_name.split(' ')[0]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  row: { gap: 14, paddingVertical: 4 },
  item: { width: 72, alignItems: 'center', gap: 6 },
  gap: { padding: 2, backgroundColor: colors.bg },
  seen: { padding: 2, borderWidth: 1.5, borderColor: colors.border, margin: 1.5 },
  plus: { position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.bg },
  label: { color: colors.muted, fontSize: 12, maxWidth: 72 },
})
