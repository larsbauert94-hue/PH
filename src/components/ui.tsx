import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Drink, User, Venue } from '../types'
import { CATEGORIES, VENUE_TYPES } from '../data/seed'

export function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  return (
    <Link
      to={`/u/${user.id}`}
      className="shrink-0 rounded-full grid place-items-center font-semibold text-ink-950"
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${user.avatarHue} 70% 70%), hsl(${user.avatarHue + 40} 60% 50%))`,
      }}
    >
      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
    </Link>
  )
}

export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label={`${value} von 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          aria-label={`${i} Sterne`}
          className={onChange ? 'p-1' : 'cursor-default'}
        >
          <Star size={size} className={i <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-600'} />
        </button>
      ))}
    </div>
  )
}

export function CategoryChip({ category, active, onClick }: { category: Drink['category']; active?: boolean; onClick?: () => void }) {
  const c = CATEGORIES[category]
  const cls = `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap border transition ${
    active ? 'bg-cream text-ink-950 border-cream' : 'border-ink-600 text-cream/80'
  }`
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{c.emoji} {c.label}</button>
    : <span className={cls}>{c.emoji} {c.label}</span>
}

/** Foto oder – ohne Foto – ein generiertes Motiv in der Farbe der Kategorie */
export function DrinkVisual({ drink, image, className = '', compact = false }: { drink: Drink; image?: string; className?: string; compact?: boolean }) {
  if (image) return <img src={image} alt={drink.name} className={`object-cover ${className}`} />
  const c = CATEGORIES[drink.category]
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${className}`}
      style={{ background: `radial-gradient(circle at 30% 20%, hsl(${c.hue} 55% 38%), hsl(${c.hue} 50% 12%) 70%)` }}
    >
      <span className={`${compact ? 'text-5xl' : 'text-[7rem]'} drop-shadow-2xl select-none`}>{c.emoji}</span>
      {!compact && <span className="absolute bottom-3 left-4 right-4 font-serif text-lg text-cream/90 truncate">{drink.name}</span>}
    </div>
  )
}

export function VenueBanner({ venue, className = '' }: { venue: Venue; className?: string }) {
  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${venue.hue} 45% 30%), hsl(${venue.hue + 30} 40% 12%))` }}
    >
      <span className="font-serif text-2xl text-cream/90 px-4 text-center">{venue.name}</span>
    </div>
  )
}

export function VenueTypeLabel({ venue }: { venue: Venue }) {
  return <span className="text-xs uppercase tracking-wider text-amber-300">{VENUE_TYPES[venue.type]} · {venue.city}</span>
}

export function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.round(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.round(h / 24)
  return d === 1 ? 'gestern' : `vor ${d} Tagen`
}
