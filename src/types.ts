export type DrinkCategory =
  | 'rotwein'
  | 'weisswein'
  | 'rose'
  | 'schaumwein'
  | 'whisky'
  | 'gin'
  | 'rum'
  | 'cocktail'
  | 'sonstiges'

export type VenueType = 'bar' | 'restaurant' | 'weinbar' | 'brennerei' | 'weingut'

export interface User {
  id: string
  handle: string
  name: string
  bio: string
  avatarHue: number
  /** Profi-Profil, z. B. Sommelier oder Barkeeper */
  role?: string
  following: string[]
}

export interface Venue {
  id: string
  name: string
  type: VenueType
  city: string
  address: string
  description: string
  hue: number
  tags: string[]
}

export interface Drink {
  name: string
  category: DrinkCategory
  producer?: string
  vintage?: number
  region?: string
}

export interface Comment {
  id: string
  userId: string
  text: string
  createdAt: number
}

export interface Post {
  id: string
  userId: string
  /** Data-URL eines hochgeladenen Fotos; ohne Foto wird ein generiertes Motiv gezeigt */
  image?: string
  drink: Drink
  rating: number
  notes: string
  venueId?: string
  likes: string[]
  comments: Comment[]
  createdAt: number
}
