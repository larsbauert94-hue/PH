import { useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES } from '../data/seed'
import type { DrinkCategory } from '../types'
import PostGrid from '../components/PostGrid'
import { Avatar, CategoryChip } from '../components/ui'
import { TopBar } from '../components/Layout'

export default function Explore() {
  const { posts, users, me, toggleFollow, venue } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<DrinkCategory | null>(null)
  const needle = q.trim().toLowerCase()

  const matches = posts
    .filter(p => !cat || p.drink.category === cat)
    .filter(p => {
      if (!needle) return true
      const d = p.drink
      return [d.name, d.producer, d.region, p.notes, venue(p.venueId)?.name, venue(p.venueId)?.city]
        .some(f => f?.toLowerCase().includes(needle))
    })
    .sort((a, b) => b.likes.length - a.likes.length)

  const people = users.filter(u => u.id !== me.id && (!needle || `${u.name} ${u.handle}`.toLowerCase().includes(needle)))

  return (
    <>
      <TopBar title="Entdecken" />
      <div className="px-4 pt-3">
        <label className="flex items-center gap-2 rounded-xl bg-ink-800 px-3 py-2">
          <Search size={18} className="text-cream/50" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Wein, Whisky, Region, Bar …"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-cream/40"
          />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
        {(Object.keys(CATEGORIES) as DrinkCategory[]).map(c => (
          <CategoryChip key={c} category={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)} />
        ))}
      </div>

      {people.length > 0 && !cat && (
        <section className="px-4 pb-3">
          <h2 className="text-xs uppercase tracking-wider text-cream/50 mb-2">Leute & Profis</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {people.map(u => {
              const following = me.following.includes(u.id)
              return (
                <div key={u.id} className="w-32 shrink-0 rounded-xl bg-ink-900 border border-ink-800 p-3 flex flex-col items-center gap-1.5">
                  <Avatar user={u} size={52} />
                  <span className="text-sm font-semibold truncate w-full text-center">{u.handle}</span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-300 h-3">{u.role}</span>
                  <button
                    onClick={() => toggleFollow(u.id)}
                    className={`mt-1 w-full rounded-lg py-1 text-xs font-semibold ${following ? 'bg-ink-700' : 'bg-wine-500'}`}
                  >
                    {following ? 'Gefolgt' : 'Folgen'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <PostGrid posts={matches} empty="Keine Treffer." />
    </>
  )
}
