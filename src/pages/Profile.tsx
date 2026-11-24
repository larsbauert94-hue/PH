import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES } from '../data/seed'
import PostGrid from '../components/PostGrid'
import { Avatar, VenueBanner } from '../components/ui'
import { TopBar } from '../components/Layout'

export default function Profile() {
  const { id } = useParams()
  const { me, user, users, posts, venues, savedVenues, toggleFollow, reset } = useStore()
  const u = id ? user(id) : me
  const [tab, setTab] = useState<'posts' | 'orte'>('posts')
  if (!u) return <><TopBar title="Nicht gefunden" back /><p className="p-8 text-center text-cream/50">Profil nicht gefunden.</p></>

  const isMe = u.id === me.id
  const up = posts.filter(p => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt)
  const followers = users.filter(x => x.following.includes(u.id)).length
  const following = me.following.includes(u.id)

  const favCounts = up.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.drink.category]: (acc[p.drink.category] ?? 0) + 1 }), {})
  const fav = Object.entries(favCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof CATEGORIES | undefined

  return (
    <>
      <TopBar
        title={u.handle}
        back={!isMe}
        right={isMe && (
          <button onClick={() => confirm('Alle Daten auf Beispieldaten zurücksetzen?') && reset()} aria-label="Zurücksetzen" className="text-cream/50 p-1">
            <RotateCcw size={18} />
          </button>
        )}
      />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-5">
          <Avatar user={u} size={80} />
          <div className="flex-1 grid grid-cols-3 text-center">
            <div><p className="font-semibold">{up.length}</p><p className="text-xs text-cream/60">Beiträge</p></div>
            <div><p className="font-semibold">{followers}</p><p className="text-xs text-cream/60">Follower</p></div>
            <div><p className="font-semibold">{u.following.length}</p><p className="text-xs text-cream/60">Folgt</p></div>
          </div>
        </div>
        <div>
          <p className="font-semibold">{u.name}{u.role && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300">{u.role}</span>}</p>
          <p className="text-sm text-cream/80">{u.bio}</p>
          {fav && <p className="text-xs text-cream/50 mt-1">Lieblingskategorie: {CATEGORIES[fav].emoji} {CATEGORIES[fav].label}</p>}
        </div>
        {!isMe && (
          <button onClick={() => toggleFollow(u.id)} className={`w-full rounded-xl py-2 text-sm font-semibold ${following ? 'bg-ink-700' : 'bg-wine-500'}`}>
            {following ? 'Gefolgt' : 'Folgen'}
          </button>
        )}
      </div>

      {isMe && (
        <div className="flex border-b border-ink-800">
          {(['posts', 'orte'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-sm ${tab === t ? 'border-b-2 border-cream' : 'text-cream/50'}`}>
              {t === 'posts' ? 'Beiträge' : 'Gemerkte Orte'}
            </button>
          ))}
        </div>
      )}

      {tab === 'posts' || !isMe ? (
        <PostGrid posts={up} empty={isMe ? 'Teile dein erstes Glas über „Posten“.' : 'Noch keine Beiträge.'} />
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3">
          {venues.filter(v => savedVenues.includes(v.id)).map(v => (
            <Link key={v.id} to={`/v/${v.id}`} className="rounded-xl overflow-hidden [&_span]:text-base">
              <VenueBanner venue={v} className="h-24" />
            </Link>
          ))}
          {!savedVenues.length && <p className="col-span-2 py-6 text-center text-sm text-cream/50">Noch keine Orte gemerkt.</p>}
        </div>
      )}
    </>
  )
}
