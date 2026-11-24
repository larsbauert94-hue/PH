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
  /** Bilder der Galerie (bei Reels: Vorschaubild) */
  media: string[]
  /** gesetzt = Reel */
  video_url: string | null
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
  saved_by_me: boolean
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
  /** nur Reels */
  reels?: boolean
  /** nur Beiträge mit Bild oder Video (Entdecken-Raster) */
  withMedia?: boolean
  /** nur eigene gespeicherte Beiträge */
  saved?: boolean
  /** Volltext bzw. #hashtag */
  search?: string
}

export interface LocalFile { uri: string; mime?: string }

export interface NewPost {
  kind: PostKind
  title?: string
  body: string
  category: Category
  link_url?: string
  venue_id?: string
  /** Bilder (Galerie, bis 10) bzw. bei Reels das Vorschaubild */
  media?: LocalFile[]
  /** Video → Reel */
  video?: LocalFile
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

export type NotificationType = 'like' | 'comment' | 'follow'

/** Zeile aus der View `notification_feed` */
export interface AppNotification {
  id: string
  user_id: string
  actor_id: string
  type: NotificationType
  post_id: string | null
  created_at: string
  read_at: string | null
  actor_handle: string
  actor_name: string
  actor_type: AccountType
  actor_avatar_url: string | null
  post_snippet: string | null
}

/** Zeile aus der View `my_conversations` */
export interface Conversation {
  id: string
  last_message_at: string
  other_id: string
  other_handle: string
  other_name: string
  other_type: AccountType
  other_avatar_url: string | null
  other_headline: string
  last_body: string | null
  last_sender_id: string | null
  unread_count: number
  blocked: boolean
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

/** Beiträge pro Seite im Feed */
export const FEED_PAGE_SIZE = 20

/** Zeile aus der View `story_feed` */
export interface Story {
  id: string
  author_id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  venue_id: string | null
  created_at: string
  expires_at: string
  author_handle: string
  author_name: string
  author_type: AccountType
  author_avatar_url: string | null
  author_verified: boolean
  venue_name: string | null
  seen_by_me: boolean
  view_count: number
}

/** Storys einer Person, wie sie in der Leiste oben im Feed erscheinen */
export interface StoryGroup {
  author_id: string
  author_name: string
  author_handle: string
  author_type: AccountType
  author_avatar_url: string | null
  stories: Story[]
  all_seen: boolean
}

export interface NewStory {
  file: LocalFile
  media_type: 'image' | 'video'
  caption?: string
  venue_id?: string
}
