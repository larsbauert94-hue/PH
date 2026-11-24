import { useLocalSearchParams } from 'expo-router'
import { useHighlightStories, useHighlights } from '../../lib/queries'
import StoryPlayer from '../../components/StoryPlayer'
import { Loading } from '../../components/ui'

/** Highlight ansehen (dieselbe Ansicht wie Storys, ohne 24-Stunden-Grenze) */
export default function HighlightScreen() {
  const { id, owner } = useLocalSearchParams<{ id: string; owner: string }>()
  const items = useHighlightStories(id)
  const highlights = useHighlights(owner ?? '')
  const title = highlights.data?.find(h => h.id === id)?.title ?? 'Highlight'
  if (items.isPending) return <Loading />
  const stories = items.data ?? []
  const first = stories[0]
  const groups = first ? [{
    author_id: first.author_id, author_name: first.author_name, author_handle: first.author_handle,
    author_type: first.author_type, author_avatar_url: first.author_avatar_url, stories, all_seen: true,
  }] : []
  return <StoryPlayer key={id} groups={groups} startAuthor={first?.author_id} highlightTitle={title} />
}
