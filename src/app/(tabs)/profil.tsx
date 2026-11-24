import { Pressable } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { useLayoutEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '../../lib/auth'
import { colors } from '../../lib/theme'
import ProfileView from '../../components/ProfileView'

export default function MyProfile() {
  const { me, profile } = useMe()
  const nav = useNavigation()
  useLayoutEffect(() => {
    nav.setOptions({
      headerTitle: `@${profile.handle}`,
      headerRight: () => (
        <Pressable onPress={() => router.push('/einstellungen')} hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="Einstellungen">
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      ),
    })
  }, [nav, profile.handle])
  return <ProfileView id={me} onEdit={() => router.push('/einstellungen')} />
}
