import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/queries'
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

/** Glocke oben rechts mit Zähler für neue Mitteilungen */
export function BellButton() {
  const { unread } = useNotifications()
  return (
    <Pressable onPress={() => router.push('/mitteilungen')} hitSlop={10} style={{ marginRight: 16 }} accessibilityLabel={unread ? `Mitteilungen, ${unread} neu` : 'Mitteilungen'}>
      <Ionicons name="notifications-outline" size={25} color={colors.text} />
      {unread > 0 && <CountBadge count={unread} style={{ position: 'absolute', top: -4, right: -6 }} />}
    </Pressable>
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
