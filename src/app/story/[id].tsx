import { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { useStories } from '../../lib/queries'
import StoryPlayer from '../../components/StoryPlayer'
import { Loading } from '../../components/ui'

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const stories = useStories()
  // Beim Öffnen festhalten, damit sich die Reihenfolge nicht ändert, während man schaut
  const [groups] = useState(() => stories.data ?? [])
  if (!groups.length && stories.isPending) return <Loading />
  return <StoryPlayer groups={groups} startAuthor={id} />
}
