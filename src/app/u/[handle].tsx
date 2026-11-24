import { Stack, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import ProfileView from '../../components/ProfileView'
import { Empty, Loading } from '../../components/ui'

/** Profil über den @Nutzernamen öffnen (z. B. aus einer Erwähnung) */
export default function ProfileByHandle() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const profile = useQuery({ queryKey: ['handle', handle], queryFn: () => api.getProfileByHandle(handle) })
  if (profile.isPending) return <Loading />
  if (!profile.data) return <Empty icon="person-outline" text={`@${handle} gibt es nicht.`} />
  return (
    <>
      <Stack.Screen options={{ title: `@${profile.data.handle}` }} />
      <ProfileView id={profile.data.id} />
    </>
  )
}
