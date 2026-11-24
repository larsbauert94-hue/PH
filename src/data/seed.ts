import type { DrinkCategory, Post, User, Venue, VenueType } from '../types'

export const CATEGORIES: Record<DrinkCategory, { label: string; emoji: string; hue: number }> = {
  rotwein: { label: 'Rotwein', emoji: '🍷', hue: 345 },
  weisswein: { label: 'Weißwein', emoji: '🥂', hue: 48 },
  rose: { label: 'Rosé', emoji: '🌸', hue: 335 },
  schaumwein: { label: 'Schaumwein', emoji: '🍾', hue: 40 },
  whisky: { label: 'Whisky', emoji: '🥃', hue: 28 },
  gin: { label: 'Gin', emoji: '🌿', hue: 170 },
  rum: { label: 'Rum', emoji: '🏝️', hue: 20 },
  cocktail: { label: 'Cocktail', emoji: '🍸', hue: 200 },
  sonstiges: { label: 'Sonstiges', emoji: '✨', hue: 270 },
}

export const VENUE_TYPES: Record<VenueType, string> = {
  bar: 'Bar',
  restaurant: 'Restaurant',
  weinbar: 'Weinbar',
  brennerei: 'Brennerei',
  weingut: 'Weingut',
}

export const CURRENT_USER_ID = 'u-me'

export const seedUsers: User[] = [
  { id: 'u-me', handle: 'du', name: 'Du', bio: 'Neugierig auf jedes Glas.', avatarHue: 20, following: ['u-lena', 'u-max', 'u-sofia'] },
  { id: 'u-lena', handle: 'lena.somm', name: 'Lena Brandt', bio: 'Sommelière · Riesling-Nerd · Mosel', avatarHue: 345, role: 'Sommelière', following: ['u-max'] },
  { id: 'u-max', handle: 'maxmixes', name: 'Max Keller', bio: 'Head Bartender @ Nachtschatten', avatarHue: 200, role: 'Bartender', following: ['u-lena'] },
  { id: 'u-sofia', handle: 'sofia_drams', name: 'Sofia Weiß', bio: 'Single Malt, Islay und Torf.', avatarHue: 28, following: [] },
  { id: 'u-jonas', handle: 'jonas.gin', name: 'Jonas Hartmann', bio: 'Craft-Gin aus dem Schwarzwald', avatarHue: 170, role: 'Brenner', following: [] },
]

export const seedVenues: Venue[] = [
  { id: 'v-nacht', name: 'Nachtschatten', type: 'bar', city: 'Berlin', address: 'Oranienstraße 12', description: 'Speakeasy mit saisonaler Cocktailkarte und über 200 Spirituosen.', hue: 210, tags: ['Cocktails', 'Speakeasy', 'Late Night'] },
  { id: 'v-rebe', name: 'Rebe & Reife', type: 'weinbar', city: 'Hamburg', address: 'Schanzenstraße 45', description: 'Naturweine, offene Flaschen und kleine Teller.', hue: 345, tags: ['Naturwein', 'Tapas'] },
  { id: 'v-ochsen', name: 'Zum Goldenen Ochsen', type: 'restaurant', city: 'München', address: 'Sendlinger Str. 8', description: 'Bayerische Küche, gehoben. Weinbegleitung mit 400 Positionen.', hue: 40, tags: ['Weinbegleitung', 'Fine Dining'] },
  { id: 'v-wald', name: 'Waldbrand Destillerie', type: 'brennerei', city: 'Freiburg', address: 'Am Hang 3', description: 'Kleine Brennerei mit Gin, Obstbränden und Tastings am Wochenende.', hue: 160, tags: ['Tastings', 'Gin'] },
  { id: 'v-schiefer', name: 'Weingut Schieferhang', type: 'weingut', city: 'Bernkastel-Kues', address: 'Moselweinstraße 21', description: 'Familienweingut in fünfter Generation, Steillagen-Riesling.', hue: 55, tags: ['Riesling', 'Weinprobe'] },
]

const h = 3600_000
const now = Date.now()

export const seedPosts: Post[] = [
  {
    id: 'p1', userId: 'u-lena', rating: 5, venueId: 'v-schiefer', createdAt: now - 2 * h,
    drink: { name: 'Riesling Spätlese Alte Reben', category: 'weisswein', producer: 'Weingut Schieferhang', vintage: 2019, region: 'Mosel' },
    notes: 'Steinobst, Petrol, eine Säure wie ein Uhrwerk. Hält locker noch zehn Jahre.',
    likes: ['u-max', 'u-sofia', 'u-me'], comments: [{ id: 'c1', userId: 'u-max', text: 'Das ist die Flasche von letzter Woche, oder? 😍', createdAt: now - h }],
  },
  {
    id: 'p2', userId: 'u-max', rating: 4, venueId: 'v-nacht', createdAt: now - 5 * h,
    drink: { name: 'Smoked Rosemary Negroni', category: 'cocktail', region: 'Berlin' },
    notes: 'Neu auf der Winterkarte: Gin, Campari, Wermut und ein Rosmarinzweig, abgeflammt.',
    likes: ['u-lena'], comments: [],
  },
  {
    id: 'p3', userId: 'u-sofia', rating: 5, createdAt: now - 26 * h,
    drink: { name: 'Lagavulin 16', category: 'whisky', producer: 'Lagavulin', region: 'Islay' },
    notes: 'Lagerfeuer am Strand. Jod, Rauch, getrocknete Früchte. Ein Klassiker.',
    likes: ['u-me', 'u-jonas'], comments: [{ id: 'c2', userId: 'u-jonas', text: 'Immer wieder gut.', createdAt: now - 20 * h }],
  },
  {
    id: 'p4', userId: 'u-jonas', rating: 4, venueId: 'v-wald', createdAt: now - 50 * h,
    drink: { name: 'Schwarzwald Dry Gin No. 3', category: 'gin', producer: 'Waldbrand Destillerie', region: 'Schwarzwald' },
    notes: 'Neue Charge mit Fichtenspitzen und Zitronenthymian. Pur mit Eis probieren!',
    likes: ['u-max'], comments: [],
  },
  {
    id: 'p5', userId: 'u-lena', rating: 4, venueId: 'v-ochsen', createdAt: now - 72 * h,
    drink: { name: 'Blaufränkisch Ried Spitzerberg', category: 'rotwein', vintage: 2018, region: 'Carnuntum' },
    notes: 'Zum Rehrücken perfekt. Dunkle Kirsche, Pfeffer, feines Tannin.',
    likes: ['u-sofia'], comments: [],
  },
]
