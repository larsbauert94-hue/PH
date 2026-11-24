import { Pressable } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Icon } from '../../components/Icon'
import { useMe } from '../../lib/auth'
import { useProfile } from '../../lib/queries'
import { colors } from '../../lib/theme'
import ProfileView from '../../components/ProfileView'

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { me } = useMe()
  const profile = useProfile(id)
  const isMe = id === me
  return (
    <>
      <Stack.Screen
        options={{
          title: isMe ? 'Mein Profil' : profile.data ? `@${profile.data.handle}` : '',
          headerRight: isMe ? () => (
            <Pressable onPress={() => router.push('/einstellungen')} hitSlop={12} accessibilityLabel="Einstellungen">
              <Icon name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          ) : undefined,
        }}
      />
      <ProfileView id={id} onEdit={isMe ? () => router.push('/einstellungen') : undefined} />
    </>
  )
}
