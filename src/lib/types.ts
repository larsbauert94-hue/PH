// Spiegelt das Schema in supabase/migrations wider.

export type BusinessType = 'bar' | 'restaurant' | 'haendler' | 'lieferant' | 'marke'
export type PersonType = 'gastro' | 'privat'
export type AccountType = BusinessType | PersonType
export type VenueType = 'bar' | 'cocktailbar' | 'weinbar' | 'restaurant' | 'hotelbar'
export type PostKind = 'beitrag' | 'neuheit' | 'angebot' | 'event' | 'job' | 'checkin' | 'rezept'
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
  /** Lebenslauf (Gastro-Profis) */
  certificates?: string[]
  skills?: string[]
  stations?: string[]
  open_to_work?: boolean
  available_from?: string | null
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
  /** Öffnungszeiten „HH:MM“ (schließt ggf. nach Mitternacht) */
  opens?: string | null
  closes?: string | null
  happy_hour?: string
  reservation_url?: string | null
  /** aus der View venue_feed */
  post_count?: number
  saved_by_me?: boolean
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
  music: Track | null
  /** Check-in: Bewertung 1–5 Tropfen, Aromen, Produkt */
  rating?: number | null
  aromas?: string[]
  product_id?: string | null
  recipe?: Recipe | null
  /** „Nachgemixt“: Original-Beitrag */
  remix_of?: string | null
  /** Gemeinsamer Beitrag mit einem zweiten Profil */
  collab_id?: string | null
  /** Beitrag in einem Raum */
  group_id?: string | null
  promoted?: boolean
  /** Job: dringend (Schichtvertretung) */
  urgent?: boolean
  /** Gestaltete Vorlage ohne Foto */
  template?: Template | null
  event_at?: string | null
}

export type Template = 'karte' | 'plakat' | 'neuheit'
export interface Recipe { ingredients: { name: string; amount: string }[]; steps: string[] }

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
  product_name?: string | null
  collab_name?: string | null
  collab_handle?: string | null
  group_name?: string | null
  remix_count?: number
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
  like_count: number
  liked_by_me: boolean
}

export type FeedTab = 'fuerdich' | 'alle' | 'folge' | 'neuheiten' | 'handel' | 'gastro' | 'jobs' | 'events' | 'checkins' | 'rezepte'

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
  /** 'top' = meiste Likes zuerst */
  sort?: 'top'
  productId?: string
  groupId?: string
  /** Nachgemixte Versionen eines Rezepts */
  remixOf?: string
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
  music?: Track
  rating?: number
  aromas?: string[]
  product_id?: string
  recipe?: Recipe
  remix_of?: string
  collab_id?: string
  group_id?: string
  urgent?: boolean
  template?: Template
  event_at?: string
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
  opens?: string
  closes?: string
  happy_hour?: string
  reservation_url?: string
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

export type ProfileUpdate = Partial<Pick<Profile, 'name' | 'headline' | 'workplace' | 'bio' | 'city' | 'website' | 'certificates' | 'skills' | 'stations' | 'open_to_work' | 'available_from'>>

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'venue_post' | 'job_match'

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
  music: Track | null
  overlays: StoryOverlay[]
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
  music?: Track
  overlays?: StoryOverlay[]
}

/** Song aus der Spotify-Suche (nur Verweis, kein Audio in der App) */
export interface Track {
  id: string
  title: string
  artist: string
  cover_url: string | null
  spotify_url: string | null
  preview_url: string | null
}

/** Sticker und Texte auf einer Story; x/y sind relative Positionen (0–1) der Mitte */
export type StoryOverlay = { x: number; y: number } & (
  | { type: 'text'; text: string; color: string; background: boolean }
  | { type: 'music'; track: Track }
  | { type: 'location'; venue_id: string; name: string }
  | { type: 'mention'; profile_id: string; handle: string }
  | { type: 'poll'; question: string; options: string[] }
  | { type: 'quiz'; question: string; options: string[]; correct: number }
  | { type: 'countdown'; title: string; at: string }
  | { type: 'link'; label: string; url: string }
  | { type: 'code'; label: string; code: string }
)

/** Ergebnisse der Umfrage-/Quiz-Sticker einer Story, je Sticker-Index */
export type StoryVotes = Record<number, { counts: number[]; mine: number | null }>

export interface Highlight {
  id: string
  owner_id: string
  title: string
  cover_url: string | null
  created_at: string
}

/** Produkt (Flasche, Wein, Spirituose) mit Bewertungen aus Check-ins */
export interface Product {
  id: string
  name: string
  brand_id: string | null
  brand_name: string
  category: Category
  description: string
  image_url: string | null
  shop_url: string | null
  created_at: string
  checkin_count: number
  avg_rating: number | null
}
export interface NewProduct { name: string; brand_name: string; category: Category; brand_id?: string }

/** Raum (Gruppe) zum Austausch, optional als Live-Tasting mit Startzeit */
export interface Group {
  id: string
  name: string
  description: string
  city: string
  emoji: string
  starts_at: string | null
  created_by: string | null
  created_at: string
  member_count: number
  joined_by_me: boolean
}
export interface NewGroup { name: string; description: string; city: string; emoji: string; starts_at?: string }

/** Gemeinsame Sammlung (z. B. „Bars für Wien“) */
export interface Collection {
  id: string
  owner_id: string
  name: string
  created_at: string
  item_count: number
  member_ids: string[]
  cover_url: string | null
}
export type CollectionItem = { id: string; created_at: string } & ({ post: FeedPost; venue?: undefined } | { venue: Venue; post?: undefined })

/** Kennzahlen für Betriebe (Pour Pro) */
export interface BusinessStats {
  views_7d: number
  views_30d: number
  followers: number
  posts: number
  likes: number
  comments: number
  saves: number
  top_post: FeedPost | null
  /** Beiträge je Wochentag (Mo–So) */
  by_weekday: number[]
}

/** Was heute an einem Ort los ist (Karte „Heute“) */
export interface VenueActivity {
  venue_id: string
  events: number
  stories: number
  checkins: number
  /** Personen, denen ich folge, mit Check-in in den letzten 6 Stunden */
  friends: string[]
}

/** Grundlage für Abzeichen: Check-ins einer Person */
export interface CheckinSummary {
  count: number
  venues: number
  cities: number
  products: number
  byCategory: Partial<Record<Category, number>>
  topRated: number
  recipes: number
  remixes: number
}
