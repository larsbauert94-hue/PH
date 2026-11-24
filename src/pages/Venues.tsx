import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Star } from 'lucide-react'
import { useStore } from '../store'
import { VENUE_TYPES } from '../data/seed'
import type { VenueType } from '../types'
import { VenueBanner, VenueTypeLabel } from '../components/ui'
import { TopBar } from '../components/Layout'

export default function Venues() {
  const { venues, posts, savedVenues, toggleSaveVenue } = useStore()
  const [type, setType] = useState<VenueType | null>(null)

  return (
    <>
      <TopBar title="Bars, Restaurants & mehr" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
        {(Object.keys(VENUE_TYPES) as VenueType[]).map(t => (
          <button
            key={t}
            onClick={() => setType(type === t ? null : t)}
            className={`rounded-full px-3 py-1 text-xs border whitespace-nowrap ${type === t ? 'bg-cream text-ink-950 border-cream' : 'border-ink-600 text-cream/80'}`}
          >
            {VENUE_TYPES[t]}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4 pb-4">
        {venues.filter(v => !type || v.type === type).map(v => {
          const vp = posts.filter(p => p.venueId === v.id)
          const avg = vp.length ? vp.reduce((s, p) => s + p.rating, 0) / vp.length : 0
          const saved = savedVenues.includes(v.id)
          return (
            <div key={v.id} className="rounded-2xl overflow-hidden bg-ink-900 border border-ink-800">
              <Link to={`/v/${v.id}`}><VenueBanner venue={v} className="h-28" /></Link>
              <div className="p-3 flex items-start gap-3">
                <Link to={`/v/${v.id}`} className="flex-1 min-w-0">
                  <VenueTypeLabel venue={v} />
                  <p className="text-sm text-cream/70 mt-1 line-clamp-2">{v.description}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-cream/60">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {avg ? avg.toFixed(1) : '–'} · {vp.length} Beiträge
                  </p>
                </Link>
                <button onClick={() => toggleSaveVenue(v.id)} aria-label={saved ? 'Gemerkt' : 'Merken'} className="p-1">
                  <Bookmark size={22} className={saved ? 'fill-amber-400 text-amber-400' : 'text-cream/60'} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
