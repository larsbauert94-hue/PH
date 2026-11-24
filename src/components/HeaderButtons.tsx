import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Icon } from './Icon'
import { useAuth } from '../lib/auth'
import { useConversations, useNotifications } from '../lib/queries'
import { colors } from '../lib/theme'
import { Avatar } from './ui'

/** Eigenes Profilbild oben links: führt zum Profil */
export function MeButton() {
  const { profile } = useAuth()
  if (!profile) return null
  return (
    <Pressable onPress={() => router.push(`/profil/${profile.id}`)} hitSlop={10} style={{ marginLeft: 16 }} accessibilityLabel="Mein Profil">
      <Avatar name={profile.name} url={profile.avatar_url} type={profile.account_type} size={32} />
    </Pressable>
  )
}

/** Oben rechts: Glocke für Mitteilungen und Sprechblasen für Nachrichten, jeweils mit Zähler */
export function HeaderActions() {
  const notes = useNotifications()
  const convs = useConversations()
  return (
    <View style={{ flexDirection: 'row', gap: 22, marginRight: 16 }}>
      <Pressable onPress={() => router.push('/mitteilungen')} hitSlop={10} accessibilityLabel={notes.unread ? `Mitteilungen, ${notes.unread} neu` : 'Mitteilungen'}>
        <Icon name="notifications-outline" size={25} color={colors.text} />
        {notes.unread > 0 && <CountBadge count={notes.unread} style={{ position: 'absolute', top: -5, right: -8 }} />}
      </Pressable>
      <Pressable onPress={() => router.push('/nachrichten')} hitSlop={10} accessibilityLabel={convs.unread ? `Nachrichten, ${convs.unread} ungelesen` : 'Nachrichten'}>
        <Icon name="chatbubbles-outline" size={25} color={colors.text} />
        {convs.unread > 0 && <CountBadge count={convs.unread} style={{ position: 'absolute', top: -5, right: -8 }} />}
      </Pressable>
    </View>
  )
}

export function CountBadge({ count, style }: { count: number; style?: object }) {
  return (
    <View style={[st.badge, style]}>
      <Text style={st.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.heart, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
})
