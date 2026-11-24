import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useProfiles } from '../lib/queries'
import { colors, radius } from '../lib/theme'
import { Avatar } from './ui'

/** Gerade getipptes @Wort am Ende des Textes */
export function mentionQuery(text: string) {
  const m = text.match(/@([a-z0-9._]{1,30})$/i)
  return m ? m[1].toLowerCase() : null
}

/** Vorschläge für @Erwähnungen; ersetzt beim Antippen das angefangene Wort */
export default function MentionSuggest({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  const q = mentionQuery(text)
  const profiles = useProfiles(undefined, q ?? undefined)
  if (!q || !profiles.data?.length) return null
  return (
    <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
      {profiles.data.slice(0, 8).map(p => (
        <Pressable key={p.id} style={st.chip} onPress={() => onChange(text.replace(/@([a-z0-9._]{1,30})$/i, `@${p.handle} `))} accessibilityLabel={`@${p.handle} erwähnen`}>
          <Avatar name={p.name} url={p.avatar_url} type={p.account_type} size={24} />
          <Text style={st.text}>@{p.handle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  row: { gap: 8, paddingVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingLeft: 4, paddingRight: 12, paddingVertical: 4 },
  text: { color: colors.text, fontSize: 13, fontWeight: '600' },
})
