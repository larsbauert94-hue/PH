import { useCallback, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useFeed } from '../../lib/queries'
import { Empty, Loading } from '../../components/ui'
import ReelViewer from '../../components/ReelViewer'
import { tap } from '../../components/motion'

/**
 * Reels bildschirmfüllend zum Hoch- und Runterwischen, die Leiste unten bleibt.
 * Ein Tipp aufs Video öffnet den kompletten Vollbildmodus ohne Leiste.
 */
export default function Reels() {
  const reels = useFeed({ reels: true })
  const [focused, setFocused] = useState(true)
  // Nur abspielen, solange der Tab sichtbar ist
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  if (reels.isPending) return <Loading />
  if (!reels.posts.length) return <Empty icon="film-outline" text="Noch keine Reels. Teile das erste über „Posten“ → Reel." />
  return (
    <ReelViewer
      posts={reels.posts}
      onEndReached={reels.loadMore}
      paused={!focused}
      title="Reels"
      onOpen={post => { tap(); router.push(`/reel/${post.id}`) }}
    />
  )
}
