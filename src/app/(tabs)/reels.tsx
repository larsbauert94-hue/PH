import { useCallback, useState } from 'react'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useFeed } from '../../lib/queries'
import { Empty, Loading } from '../../components/ui'
import ReelViewer from '../../components/ReelViewer'

/**
 * Reels bildschirmfüllend wie bei TikTok: hoch und runter wischen, rechts Anstoßen, Kommentare,
 * Senden, Merken; die Leiste unten bleibt. Tippen pausiert, doppelt tippen stößt an.
 */
export default function Reels() {
  const reels = useFeed({ reels: true })
  // Aus dem Feed geöffnet: an diesem Reel starten
  const { start } = useLocalSearchParams<{ start?: string; t?: string }>()
  const [focused, setFocused] = useState(true)
  // Nur abspielen, solange der Tab sichtbar ist
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  if (reels.isPending) return <Loading />
  if (!reels.posts.length) return <Empty icon="film-outline" text="Noch keine Reels. Teile das erste über „Posten“ → Reel." />
  return (
    <ReelViewer
      key={start ?? 'alle'}
      startId={start}
      posts={reels.posts}
      onEndReached={reels.loadMore}
      paused={!focused}
      title="Reels"
    />
  )
}
