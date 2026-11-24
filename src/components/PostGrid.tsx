import { Link } from 'react-router-dom'
import type { Post } from '../types'
import { DrinkVisual } from './ui'

export default function PostGrid({ posts, empty = 'Noch keine Beiträge.' }: { posts: Post[]; empty?: string }) {
  if (!posts.length) return <p className="p-8 text-center text-sm text-cream/50">{empty}</p>
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {posts.map(p => (
        <Link key={p.id} to={`/p/${p.id}`} className="block">
          <DrinkVisual drink={p.drink} image={p.image} className="w-full aspect-square" compact />
        </Link>
      ))}
    </div>
  )
}
