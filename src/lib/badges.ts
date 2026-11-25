import type { CheckinSummary } from './types'
import type { IconName } from '../components/Icon'

export interface BadgeDef { id: string; title: string; text: string; icon: IconName; target: number; value: (s: CheckinSummary) => number }

/** Abzeichen, die man mit Check-ins, Rezepten und Nachmixen sammelt */
export const BADGES: BadgeDef[] = [
  { id: 'erster-schluck', title: 'Erster Schluck', text: 'Dein erster Check-in', icon: 'cheers-outline', target: 1, value: s => s.count },
  { id: 'stammgast', title: 'Stammgast', text: 'In 3 verschiedenen Orten eingecheckt', icon: 'location-outline', target: 3, value: s => s.venues },
  { id: 'entdecker', title: 'Entdecker:in', text: 'In 10 verschiedenen Orten eingecheckt', icon: 'compass-outline', target: 10, value: s => s.venues },
  { id: 'staedtereise', title: 'Städtereise', text: 'Check-ins in 3 Städten', icon: 'map-outline', target: 3, value: s => s.cities },
  { id: 'spirituosen', title: 'Spirituosen-Kenner', text: '5 Spirituosen bewertet', icon: 'flask-outline', target: 5, value: s => s.byCategory.spirituosen ?? 0 },
  { id: 'wein', title: 'Weinfreund:in', text: '5 Weine bewertet', icon: 'wine-outline', target: 5, value: s => s.byCategory.wein ?? 0 },
  { id: 'cocktails', title: 'Cocktail-Connaisseur', text: '5 Cocktails bewertet', icon: 'sparkles-outline', target: 5, value: s => s.byCategory.cocktails ?? 0 },
  { id: 'nullkommanull', title: 'Null-Komma-Null', text: '3 alkoholfreie Drinks bewertet', icon: 'leaf-outline', target: 3, value: s => s.byCategory.alkoholfrei ?? 0 },
  { id: 'feinschmecker', title: 'Volle Tropfen', text: '5-mal die Höchstwertung vergeben', icon: 'water-outline', target: 5, value: s => s.topRated },
  { id: 'sammler', title: 'Flaschensammler:in', text: '10 verschiedene Flaschen eingecheckt', icon: 'albums-outline', target: 10, value: s => s.products },
  { id: 'rezept', title: 'Rezeptautor:in', text: 'Ein eigenes Rezept geteilt', icon: 'document-text-outline', target: 1, value: s => s.recipes },
  { id: 'nachmixer', title: 'Nachmixer:in', text: '3 Rezepte nachgemixt', icon: 'repeat-outline', target: 3, value: s => s.remixes },
  { id: 'profi', title: 'Check-in-Profi', text: '25 Check-ins', icon: 'ribbon-outline', target: 25, value: s => s.count },
]

export function badgeProgress(s: CheckinSummary) {
  return BADGES.map(b => {
    const v = Math.min(b.value(s), b.target)
    return { ...b, current: v, earned: v >= b.target }
  })
}

/** Abzeichen, die zwischen zwei Ständen neu dazugekommen sind */
export function newlyEarned(before: CheckinSummary | undefined, after: CheckinSummary) {
  const had = new Set(before ? badgeProgress(before).filter(b => b.earned).map(b => b.id) : [])
  return badgeProgress(after).filter(b => b.earned && !had.has(b.id))
}
