import type { AccountType, Category, FeedTab, PostKind, VenueType } from './types'

export const ACCOUNT_TYPES: Record<AccountType, { label: string; plural: string; icon: string; business: boolean }> = {
  bar: { label: 'Bar', plural: 'Bars', icon: 'wine', business: true },
  restaurant: { label: 'Restaurant', plural: 'Restaurants', icon: 'restaurant', business: true },
  haendler: { label: 'Händler', plural: 'Händler', icon: 'storefront', business: true },
  lieferant: { label: 'Lieferant', plural: 'Lieferanten', icon: 'cube', business: true },
  marke: { label: 'Marke / Produzent', plural: 'Marken', icon: 'ribbon', business: true },
  gastro: { label: 'Gastro & Branche', plural: 'Gastro-Profis', icon: 'person', business: false },
  privat: { label: 'Genießer:in', plural: 'Genießer:innen', icon: 'heart', business: false },
}

export const VENUE_TYPES: Record<VenueType, { label: string; color: string }> = {
  bar: { label: 'Bar', color: '#e8ad5a' },
  cocktailbar: { label: 'Cocktailbar', color: '#5ab4e8' },
  weinbar: { label: 'Weinbar', color: '#d0627a' },
  restaurant: { label: 'Restaurant', color: '#7cc47f' },
  hotelbar: { label: 'Hotelbar', color: '#b48ce8' },
}

export const POST_KINDS: Record<PostKind, { label: string; icon: string }> = {
  beitrag: { label: 'Beitrag', icon: 'chatbubble-ellipses' },
  neuheit: { label: 'Neuheit', icon: 'sparkles' },
  angebot: { label: 'Angebot', icon: 'pricetag' },
  event: { label: 'Event', icon: 'calendar' },
  job: { label: 'Job', icon: 'briefcase' },
  checkin: { label: 'Check-in', icon: 'wine' },
  rezept: { label: 'Rezept', icon: 'flask' },
}

export const CATEGORIES: Record<Category, string> = {
  wein: 'Wein',
  spirituosen: 'Spirituosen',
  bier: 'Bier',
  cocktails: 'Cocktails',
  alkoholfrei: 'Alkoholfrei',
  gastronomie: 'Gastronomie',
}

export const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: 'fuerdich', label: 'Für dich' },
  { key: 'alle', label: 'Neueste' },
  { key: 'folge', label: 'Folge ich' },
  { key: 'neuheiten', label: 'Neuheiten' },
  { key: 'handel', label: 'Marken & Handel' },
  { key: 'gastro', label: 'Bars & Restaurants' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'events', label: 'Events' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'rezepte', label: 'Rezepte' },
]

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.round(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.round(h / 24)
  if (d === 1) return 'gestern'
  if (d < 7) return `vor ${d} Tagen`
  return new Date(iso).toLocaleDateString('de-DE')
}

/** Zeile unter dem Namen: Position bei Personen, Typ bei Betrieben */
export function subtitle(p: { account_type: AccountType; headline?: string; workplace?: string; city?: string }) {
  if (!ACCOUNT_TYPES[p.account_type].business) {
    const job = [p.headline, p.workplace].filter(Boolean).join(' @ ')
    return job || ACCOUNT_TYPES[p.account_type].label
  }
  return [ACCOUNT_TYPES[p.account_type].label, p.city].filter(Boolean).join(' · ')
}

/** Aromen zur Auswahl beim Check-in */
export const AROMAS = ['fruchtig', 'zitrisch', 'blumig', 'würzig', 'rauchig', 'harzig', 'mineralisch', 'Steinobst', 'Beeren', 'Honig', 'Vanille', 'Schokolade', 'bitter', 'süß', 'trocken', 'frisch', 'Orange', 'Kräuter', 'getreidig', 'Petrol']

/** Ist ein Ort gerade geöffnet? Schließzeiten nach Mitternacht werden berücksichtigt. */
export function isOpenNow(opens?: string | null, closes?: string | null, now = new Date()) {
  if (!opens || !closes) return null
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const cur = now.getHours() * 60 + now.getMinutes()
  const o = m(opens), c = m(closes)
  return c > o ? cur >= o && cur < c : cur >= o || cur < c
}
