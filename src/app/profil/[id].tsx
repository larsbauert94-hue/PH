import { Stack, useLocalSearchParams } from 'expo-router'
import { useProfile } from '../../lib/queries'
import ProfileView from '../../components/ProfileView'

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const profile = useProfile(id)
  return (
    <>
      <Stack.Screen options={{ title: profile.data ? `@${profile.data.handle}` : '' }} />
      <ProfileView id={id} />
    </>
  )
}
