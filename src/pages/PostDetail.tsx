import { useParams } from 'react-router-dom'
import { useStore } from '../store'
import PostCard from '../components/PostCard'
import { TopBar } from '../components/Layout'

export default function PostDetail() {
  const { id } = useParams()
  const post = useStore().posts.find(p => p.id === id)
  return (
    <>
      <TopBar title="Beitrag" back />
      {post ? <PostCard post={post} expanded /> : <p className="p-8 text-center text-cream/50">Dieser Beitrag wurde gelöscht.</p>}
    </>
  )
}
