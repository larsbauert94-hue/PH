// Spiegelt das Schema in supabase/migrations wider.

export type BusinessType = 'bar' | 'restaurant' | 'haendler' | 'lieferant' | 'marke'
export type PersonType = 'gastro' | 'privat'
export type AccountType = BusinessType | PersonType
export type VenueType = 'bar' | 'cocktailbar' | 'weinbar' | 'restaurant' | 'hotelbar'
export type PostKind = 'beitrag' | 'neuheit' | 'angebot' | 'event' | 'job'
export type Category = 'wein' | 'spirituosen' | 'bier' | 'cocktails' | 'alkoholfrei' | 'gastronomie'

export interface Profile {
  id: string
  handle: string
  name: string
  account_type: AccountType
  headline: string
  workplace: string
  bio: string
  city: string
  website: string | null
  avatar_url: string | null
  verified: boolean
  created_at: string
}

export interface ProfileStats {
  id: string
  post_count: number
  follower_count: number
  following_count: number
  followed_by_me: boolean
  blocked_by_me: boolean
}

export interface Venue {
  id: string
  owner_id: string | null
  name: string
  type: VenueType
  address: string
  city: string
  latitude: number
  longitude: number
  description: string
  website: string | null
  phone: string | null
  created_at: string
}

export interface Post {
  id: string
  author_id: string
  kind: PostKind
  title: string | null
  body: string
  image_url: string | null
  category: Category
  link_url: string | null
  venue_id: string | null
  created_at: string
}

/** Zeile aus der View `feed` */
export interface FeedPost extends Post {
  author_handle: string
  author_name: string
  author_type: AccountType
  author_headline: string
  author_avatar_url: string | null
  author_verified: boolean
  venue_name: string | null
  venue_city: string | null
  like_count: number
  comment_count: number
  liked_by_me: boolean
}

/** Zeile aus der View `comment_feed` */
export interface FeedComment {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  author_handle: string
  author_name: string
  author_type: AccountType
  author_avatar_url: string | null
}

export type FeedTab = 'alle' | 'folge' | 'neuheiten' | 'handel' | 'gastro' | 'jobs' | 'events'

export interface FeedQuery {
  tab?: FeedTab
  authorId?: string
  venueId?: string
}

export interface NewPost {
  kind: PostKind
  title?: string
  body: string
  category: Category
  link_url?: string
  venue_id?: string
  /** Lokale Datei-URI vom Image-Picker */
  imageUri?: string
  imageMime?: string
}

export interface NewVenue {
  name: string
  type: VenueType
  address: string
  city: string
  latitude: number
  longitude: number
  description: string
  website?: string
  phone?: string
}

export interface SignUpData {
  email: string
  password: string
  name: string
  handle: string
  account_type: AccountType
  headline: string
  workplace: string
  city: string
}

export type ProfileUpdate = Partial<Pick<Profile, 'name' | 'headline' | 'workplace' | 'bio' | 'city' | 'website'>>
