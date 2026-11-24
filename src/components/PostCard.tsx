import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MapPin, MessageCircle, Send, Trash2 } from 'lucide-react'
import type { Post } from '../types'
import { useStore } from '../store'
import { Avatar, CategoryChip, DrinkVisual, Stars, timeAgo } from './ui'

export default function PostCard({ post, expanded = false }: { post: Post; expanded?: boolean }) {
  const { user, venue, me, toggleLike, addComment, deletePost } = useStore()
  const [text, setText] = useState('')
  const author = user(post.userId)
  const place = venue(post.venueId)
  const liked = post.likes.includes(me.id)
  if (!author) return null

  const d = post.drink
  const meta = [d.producer, d.vintage, d.region].filter(Boolean).join(' · ')
  const comments = expanded ? post.comments : post.comments.slice(-1)

  return (
    <article className="border-b border-ink-800 pb-4">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar user={author} />
        <div className="min-w-0 flex-1">
          <Link to={`/u/${author.id}`} className="font-semibold text-sm">
            {author.handle}
            {author.role && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300">{author.role}</span>}
          </Link>
          {place && (
            <Link to={`/v/${place.id}`} className="flex items-center gap-1 text-xs text-cream/60 truncate">
              <MapPin size={12} /> {place.name}, {place.city}
            </Link>
          )}
        </div>
        {post.userId === me.id && (
          <button onClick={() => confirm('Beitrag löschen?') && deletePost(post.id)} aria-label="Löschen" className="text-cream/40 p-1">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      <div onDoubleClick={() => !liked && toggleLike(post.id)}>
        <DrinkVisual drink={d} image={post.image} className="w-full aspect-square" />
      </div>

      <div className="px-4 pt-3 space-y-2">
        <div className="flex items-center gap-4">
          <button onClick={() => toggleLike(post.id)} aria-label="Gefällt mir" className="flex items-center gap-1.5">
            <Heart size={24} className={liked ? 'fill-wine-500 text-wine-500' : ''} />
            <span className="text-sm">{post.likes.length}</span>
          </button>
          <Link to={`/p/${post.id}`} aria-label="Kommentare" className="flex items-center gap-1.5">
            <MessageCircle size={24} /> <span className="text-sm">{post.comments.length}</span>
          </Link>
          <div className="ml-auto"><Stars value={post.rating} /></div>
        </div>

        <div>
          <h2 className="font-serif text-xl leading-tight">{d.name}</h2>
          {meta && <p className="text-xs text-cream/60 mt-0.5">{meta}</p>}
        </div>
        <CategoryChip category={d.category} />
        {post.notes && (
          <p className="text-sm text-cream/90">
            <Link to={`/u/${author.id}`} className="font-semibold mr-1.5">{author.handle}</Link>{post.notes}
          </p>
        )}

        {!expanded && post.comments.length > 1 && (
          <Link to={`/p/${post.id}`} className="block text-sm text-cream/50">Alle {post.comments.length} Kommentare ansehen</Link>
        )}
        {comments.map(c => {
          const cu = user(c.userId)
          return (
            <p key={c.id} className="text-sm">
              <span className="font-semibold mr-1.5">{cu?.handle}</span>{c.text}
              {expanded && <span className="ml-2 text-xs text-cream/40">{timeAgo(c.createdAt)}</span>}
            </p>
          )
        })}
        <p className="text-[11px] uppercase tracking-wide text-cream/40">{timeAgo(post.createdAt)}</p>

        <form
          className="flex items-center gap-2 pt-1"
          onSubmit={e => { e.preventDefault(); if (text.trim()) { addComment(post.id, text.trim()); setText('') } }}
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Kommentieren …"
            className="flex-1 bg-transparent text-sm placeholder:text-cream/30 outline-none py-1"
          />
          {text.trim() && <button aria-label="Senden" className="text-amber-400"><Send size={18} /></button>}
        </form>
      </div>
    </article>
  )
}
