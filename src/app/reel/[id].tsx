import { router, useLocalSearchParams } from 'expo-router'
import { useFeed } from '../../lib/queries'
import { Loading } from '../../components/ui'
import ReelViewer from '../../components/ReelViewer'

export default function ReelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const reels = useFeed({ reels: true })
  if (reels.isPending) return <Loading />
  return <ReelViewer posts={reels.posts} startId={id} onEndReached={reels.loadMore} onClose={() => router.canGoBack() ? router.back() : router.replace('/reels')} />
}
