import { useParams } from 'react-router-dom'
import { Bookmark, MapPin, Star } from 'lucide-react'
import { useStore } from '../store'
import PostGrid from '../components/PostGrid'
import { VenueBanner, VenueTypeLabel } from '../components/ui'
import { TopBar } from '../components/Layout'

export default function VenueDetail() {
  const { id } = useParams()
  const { venue, posts, savedVenues, toggleSaveVenue } = useStore()
  const v = venue(id)
  if (!v) return <><TopBar title="Nicht gefunden" back /><p className="p-8 text-center text-cream/50">Diesen Ort gibt es nicht.</p></>

  const vp = posts.filter(p => p.venueId === v.id).sort((a, b) => b.createdAt - a.createdAt)
  const avg = vp.length ? vp.reduce((s, p) => s + p.rating, 0) / vp.length : 0
  const saved = savedVenues.includes(v.id)

  return (
    <>
      <TopBar title={v.name} back />
      <VenueBanner venue={v} className="h-44" />
      <div className="p-4 space-y-3">
        <VenueTypeLabel venue={v} />
        <p className="text-sm text-cream/80">{v.description}</p>
        <p className="flex items-center gap-1.5 text-sm text-cream/60"><MapPin size={14} /> {v.address}, {v.city}</p>
        <div className="flex flex-wrap gap-2">
          {v.tags.map(t => <span key={t} className="rounded-full bg-ink-800 px-3 py-1 text-xs">{t}</span>)}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 rounded-xl bg-ink-900 border border-ink-800 p-3 text-center">
            <p className="flex items-center justify-center gap-1 font-serif text-2xl">
              <Star size={18} className="fill-amber-400 text-amber-400" /> {avg ? avg.toFixed(1) : '–'}
            </p>
            <p className="text-xs text-cream/50">Ø Bewertung</p>
          </div>
          <div className="flex-1 rounded-xl bg-ink-900 border border-ink-800 p-3 text-center">
            <p className="font-serif text-2xl">{vp.length}</p>
            <p className="text-xs text-cream/50">Beiträge</p>
          </div>
        </div>
        <button
          onClick={() => toggleSaveVenue(v.id)}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${saved ? 'bg-ink-700' : 'bg-wine-500'}`}
        >
          <Bookmark size={16} className={saved ? 'fill-cream' : ''} /> {saved ? 'Gemerkt' : 'Merken'}
        </button>
      </div>
      <h2 className="px-4 pb-2 text-xs uppercase tracking-wider text-cream/50">Hier getrunken</h2>
      <PostGrid posts={vp} empty="Noch niemand hat hier etwas gepostet. Sei die erste Person!" />
    </>
  )
}
