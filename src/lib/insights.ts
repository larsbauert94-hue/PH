// Auswertungen, die Supabase- und Demo-Modus gemeinsam nutzen
import type { BusinessStats, Category, CheckinSummary, FeedPost, StoryVotes, VenueActivity } from './types'

export interface RankContext { me: string; following: Set<string>; city: string; liked: Category[] }

/** „Für dich“: Hervorgehobenes, Gefolgte, eigene Stadt und Lieblingskategorien nach oben */
export function rankPosts(list: FeedPost[], c: RankContext) {
  const hours = (p: FeedPost) => (Date.now() - new Date(p.created_at).getTime()) / 3_600_000
  const score = (p: FeedPost) =>
    // eigene, gerade geteilte Beiträge zuerst
    (p.author_id === c.me && hours(p) < 2 ? 100 : 0)
    + (p.promoted ? 6 : 0) + (c.following.has(p.author_id) ? 3 : 0) + (c.city && p.venue_city === c.city ? 2 : 0)
    + c.liked.filter(x => x === p.category).length * 0.3 + Math.min(p.like_count, 20) * 0.1
    - (Date.now() - new Date(p.created_at).getTime()) / 3_600_000 / 24
  return [...list].sort((a, b) => score(b) - score(a))
}

export function summarize(posts: { kind: string; venue_id: string | null; product_id?: string | null; category: Category; rating?: number | null; remix_of?: string | null; venue_city?: string | null }[]): CheckinSummary {
  const ch = posts.filter(p => p.kind === 'checkin')
  const byCategory: CheckinSummary['byCategory'] = {}
  for (const p of ch) byCategory[p.category] = (byCategory[p.category] ?? 0) + 1
  return {
    count: ch.length,
    venues: new Set(ch.flatMap(p => p.venue_id ? [p.venue_id] : [])).size,
    cities: new Set(ch.flatMap(p => p.venue_city ? [p.venue_city] : [])).size,
    products: new Set(ch.flatMap(p => p.product_id ? [p.product_id] : [])).size,
    byCategory,
    topRated: ch.filter(p => p.rating === 5).length,
    recipes: posts.filter(p => p.kind === 'rezept').length,
    remixes: posts.filter(p => p.remix_of).length,
  }
}

export function tally(votes: { user_id: string; sticker: number; option: number }[], me?: string): StoryVotes {
  const out: StoryVotes = {}
  for (const v of votes) {
    const t = out[v.sticker] ??= { counts: [0, 0, 0, 0], mine: null }
    t.counts[v.option]++
    if (v.user_id === me) t.mine = v.option
  }
  return out
}

export function businessStats(list: FeedPost[], base: { views_7d: number; views_30d: number; followers: number; saves: number }): BusinessStats {
  const by_weekday = [0, 0, 0, 0, 0, 0, 0]
  for (const p of list) by_weekday[(new Date(p.created_at).getDay() + 6) % 7]++
  const top = [...list].sort((a, b) => (b.like_count + b.comment_count * 2) - (a.like_count + a.comment_count * 2))[0] ?? null
  return {
    ...base,
    posts: list.length,
    likes: list.reduce((n, p) => n + p.like_count, 0),
    comments: list.reduce((n, p) => n + p.comment_count, 0),
    top_post: top,
    by_weekday,
  }
}

export async function activity(
  posts: { venue_id: string; kind: string; author_id: string; created_at: string }[],
  stories: { venue_id: string }[],
  following: Set<string>,
  nameOf: (id: string) => Promise<string>,
): Promise<VenueActivity[]> {
  const map = new Map<string, VenueActivity>()
  const get = (id: string) => map.get(id) ?? (map.set(id, { venue_id: id, events: 0, stories: 0, checkins: 0, friends: [] }), map.get(id)!)
  const sixH = Date.now() - 6 * 3_600_000
  for (const p of posts) {
    const a = get(p.venue_id)
    if (p.kind === 'event') a.events++
    if (p.kind === 'checkin') {
      a.checkins++
      if (following.has(p.author_id) && new Date(p.created_at).getTime() > sixH) {
        const n = await nameOf(p.author_id)
        if (n && !a.friends.includes(n)) a.friends.push(n)
      }
    }
  }
  for (const st of stories) get(st.venue_id).stories++
  // nur Orte, an denen heute wirklich etwas los ist
  return [...map.values()].filter(a => a.events || a.stories || a.checkins || a.friends.length)
}
