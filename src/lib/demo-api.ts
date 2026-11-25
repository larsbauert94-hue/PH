// In-Memory-Backend für den Demo-Modus (ohne Supabase-Zugangsdaten).
// Verhält sich wie die Supabase-Views, damit die App identisch funktioniert.
import type { Api } from './api'
import type { AppNotification, Collection, CollectionItem, Conversation, FeedComment, FeedPost, Group, Highlight, Message, NotificationType, Post, Product, Profile, Story, StoryOverlay, Track, Venue } from './types'
import { activity, businessStats, rankPosts, summarize, tally } from './insights'
import { demoUri } from './demo-media'
import { groupStories } from './stories'
import { FEED_PAGE_SIZE } from './types'
import { DEMO_TRACKS, seedGroups, seedProducts, seedArchivedStories, seedHighlights, seedStoryExtras, seedComments, seedConversations, seedStories, seedFollows, seedLikes, seedPosts, seedProfiles, seedVenues } from './demo-data'

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const uid = () => `demo-${Math.random().toString(36).slice(2, 10)}`
const wait = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 120))

const db = {
  profiles: seedProfiles.map(({ email: _email, ...p }) => ({
    ...p, avatar_url: null as string | null, created_at: ago(24 * 90), terms_accepted_at: ago(24 * 90) as string | null,
  })),
  venues: seedVenues.map(v => ({ ...v, created_at: ago(24 * 60) })) as Venue[],
  posts: seedPosts.map(({ hoursAgo, media, video, music, ...p }) => {
    const urls = (media ?? []).map(demoUri)
    return {
      rating: null, aromas: [], product_id: null, recipe: null, remix_of: null, collab_id: null, group_id: null, promoted: false, urgent: false, template: null, event_at: null,
      ...p, media: urls, image_url: urls[0] ?? null, video_url: video ? demoUri(video) : null, music: music ?? null, created_at: ago(hoursAgo),
    }
  }) as Post[],
  products: seedProducts.map(pr => ({ ...pr, image_url: null as string | null, created_at: ago(24 * 30) })),
  groups: seedGroups.map(({ members: _m, startsInHours, ...g }) => ({ ...g, starts_at: startsInHours == null ? null : new Date(Date.now() + startsInHours * 3_600_000).toISOString(), created_at: ago(24 * 20) as string, created_by: g.created_by as string | null })),
  groupMembers: seedGroups.flatMap(g => g.members.map(user_id => ({ group_id: g.id, user_id }))),
  collections: [] as { id: string; owner_id: string; name: string; created_at: string }[],
  collectionMembers: [] as { collection_id: string; user_id: string }[],
  collectionItems: [] as { id: string; collection_id: string; post_id: string | null; venue_id: string | null; created_at: string }[],
  storyVotes: [] as { story_id: string; user_id: string; sticker: number; option: number }[],
  profileViews: [] as { profile_id: string; viewer_id: string; day: string }[],
  saves: [] as { user_id: string; post_id: string }[],
  stories: [...seedStories, ...seedArchivedStories].map(st => {
    const extra = seedStoryExtras[st.id] ?? {}
    const overlays: StoryOverlay[] = extra.overlays ?? []
    const loc = overlays.find(o => o.type === 'location')
    return {
      id: st.id, author_id: st.author_id, media_url: demoUri(st.media), media_type: 'image' as 'image' | 'video', caption: st.caption,
      venue_id: (loc?.type === 'location' ? loc.venue_id : null) as string | null, created_at: ago(st.hoursAgo), expires_at: ago(st.hoursAgo - 24),
      music: (extra.music ?? null) as Track | null, overlays,
    }
  }),
  highlights: seedHighlights.map(h => ({ id: h.id, owner_id: h.owner_id, title: h.title, cover_url: demoUri(h.cover) as string | null, created_at: ago(24 * 3), stories: h.stories })),
  commentLikes: [] as { comment_id: string; user_id: string }[],
  venueSaves: [] as { user_id: string; venue_id: string }[],
  storyViews: [] as { story_id: string; viewer_id: string }[],
  likes: seedLikes.map(([post_id, user_id]) => ({ post_id, user_id })),
  comments: seedComments.map(({ hoursAgo, ...c }) => ({ ...c, created_at: ago(hoursAgo) })),
  follows: seedFollows.map(([follower_id, following_id]) => ({ follower_id, following_id })),
  blocks: [] as { blocker_id: string; blocked_id: string }[],
  notifications: [] as { id: string; user_id: string; actor_id: string; type: NotificationType; post_id: string | null; created_at: string; read_at: string | null }[],
  conversations: seedConversations.map(c => ({
    id: c.id,
    members: c.members.map(m => ({ user_id: m, last_read_at: ago(c.messages[c.messages.length - 1][2] + 0.1) })),
  })),
  messages: seedConversations.flatMap(c => c.messages.map(([sender_id, body, h], i) => ({
    id: `${c.id}-${i}`, conversation_id: c.id, sender_id, body, created_at: ago(h),
  }))) as Message[],
}

// Mitteilungen wie die Datenbank-Trigger aus den Beispieldaten ableiten
for (const f of db.follows) db.notifications.push({ id: uid(), user_id: f.following_id, actor_id: f.follower_id, type: 'follow', post_id: null, created_at: ago(30), read_at: null })
for (const l of db.likes) {
  const p = db.posts.find(x => x.id === l.post_id)
  if (p && p.author_id !== l.user_id) db.notifications.push({ id: uid(), user_id: p.author_id, actor_id: l.user_id, type: 'like', post_id: p.id, created_at: ago(12), read_at: null })
}
for (const c of db.comments) {
  const p = db.posts.find(x => x.id === c.post_id)
  if (p && p.author_id !== c.author_id) db.notifications.push({ id: uid(), user_id: p.author_id, actor_id: c.author_id, type: 'comment', post_id: p.id, created_at: c.created_at, read_at: null })
}

function notify(userId: string, actorId: string, type: NotificationType, postId: string | null = null) {
  if (userId !== actorId) db.notifications.push({ id: uid(), user_id: userId, actor_id: actorId, type, post_id: postId, created_at: new Date().toISOString(), read_at: null })
}

/** Wie der Datenbank-Trigger: alle @erwähnten Profile benachrichtigen */
function notifyMentions(text: string, actorId: string, postId: string) {
  const handles = new Set([...text.matchAll(/@([a-z0-9._]{3,30})/gi)].map(m => m[1].toLowerCase()))
  for (const h of handles) {
    const p = db.profiles.find(x => x.handle === h)
    if (p) notify(p.id, actorId, 'mention', postId)
  }
}

function toStory(st: (typeof db.stories)[number], me: string): Story {
  const a = db.profiles.find(x => x.id === st.author_id)!
  return {
    ...st, author_handle: a.handle, author_name: a.name, author_type: a.account_type, author_avatar_url: a.avatar_url, author_verified: a.verified,
    venue_name: db.venues.find(v => v.id === st.venue_id)?.name ?? null,
    seen_by_me: db.storyViews.some(v => v.story_id === st.id && v.viewer_id === me),
    view_count: db.storyViews.filter(v => v.story_id === st.id).length,
  }
}

function toVenue(v: Venue): Venue {
  return { ...v, post_count: db.posts.filter(p => p.venue_id === v.id).length, saved_by_me: db.venueSaves.some(s => s.venue_id === v.id && s.user_id === currentUser) }
}

let currentUser = ''
const blocked = (other: string) =>
  db.blocks.some(b => (b.blocker_id === currentUser && b.blocked_id === other) || (b.blocker_id === other && b.blocked_id === currentUser))

function toFeed(p: Post): FeedPost {
  const a = db.profiles.find(x => x.id === p.author_id)!
  const v = db.venues.find(x => x.id === p.venue_id)
  return {
    ...p,
    author_handle: a.handle, author_name: a.name, author_type: a.account_type, author_headline: a.headline,
    author_avatar_url: a.avatar_url, author_verified: a.verified,
    venue_name: v?.name ?? null, venue_city: v?.city ?? null,
    like_count: db.likes.filter(l => l.post_id === p.id).length,
    comment_count: db.comments.filter(c => c.post_id === p.id && !blocked(c.author_id)).length,
    liked_by_me: db.likes.some(l => l.post_id === p.id && l.user_id === currentUser),
    saved_by_me: db.saves.some(x => x.post_id === p.id && x.user_id === currentUser),
    product_name: db.products.find(x => x.id === p.product_id)?.name ?? null,
    collab_name: db.profiles.find(x => x.id === p.collab_id)?.name ?? null,
    collab_handle: db.profiles.find(x => x.id === p.collab_id)?.handle ?? null,
    group_name: db.groups.find(x => x.id === p.group_id)?.name ?? null,
    remix_count: db.posts.filter(x => x.remix_of === p.id).length,
  }
}

function toProduct(pr: (typeof db.products)[number]): Product {
  const rated = db.posts.filter(p => p.product_id === pr.id && p.rating != null)
  return { ...pr, checkin_count: rated.length, avg_rating: rated.length ? Math.round(rated.reduce((n, p) => n + (p.rating ?? 0), 0) / rated.length * 10) / 10 : null }
}
function toGroup(g: (typeof db.groups)[number]): Group {
  const m = db.groupMembers.filter(x => x.group_id === g.id)
  return { ...g, member_count: m.length, joined_by_me: m.some(x => x.user_id === currentUser) }
}
const canSeeCollection = (id: string) =>
  db.collections.some(c => c.id === id && c.owner_id === currentUser) || db.collectionMembers.some(m => m.collection_id === id && m.user_id === currentUser)
function toCollection(c: (typeof db.collections)[number]): Collection {
  const items = db.collectionItems.filter(i => i.collection_id === c.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const cover = items.map(i => db.posts.find(p => p.id === i.post_id)?.image_url).find(Boolean) ?? null
  return { ...c, item_count: items.length, member_ids: db.collectionMembers.filter(m => m.collection_id === c.id).map(m => m.user_id), cover_url: cover }
}

const strip = ({ terms_accepted_at: _t, ...p }: (typeof db.profiles)[number]): Profile => p

/** Im Demo-Modus: Anmeldung mit beliebigen Daten, neue Accounts landen im Onboarding */
export const demoAuth = {
  signIn(userId: string) { currentUser = userId },
  signOut() { currentUser = '' },
  createUser(email: string) {
    const id = uid()
    const handle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24) || 'nutzer'
    db.profiles.push({
      id, handle, name: handle, account_type: 'privat', headline: '', workplace: '', bio: '', city: '',
      website: null, avatar_url: null, verified: false, created_at: new Date().toISOString(), terms_accepted_at: null,
    })
    return id
  },
}

export const demoApi: Api = {
  async getMyProfile(userId) {
    const p = db.profiles.find(x => x.id === userId)
    return wait(p ? { ...p } : null) // Kopie, damit React die Änderung erkennt
  },
  async completeOnboarding(d) {
    const handle = d.handle.trim().toLowerCase()
    if (db.profiles.some(p => p.handle === handle && p.id !== currentUser)) throw new Error('Dieser Nutzername ist schon vergeben.')
    const p = db.profiles.find(x => x.id === currentUser)!
    Object.assign(p, { ...d, handle, terms_accepted_at: new Date().toISOString() })
    return wait(undefined)
  },
  async uploadAvatar(userId, uri) {
    db.profiles.find(p => p.id === userId)!.avatar_url = uri
    return wait(uri)
  },
  async updateProfile(userId, data) {
    Object.assign(db.profiles.find(p => p.id === userId)!, data)
    return wait(undefined)
  },
  async deleteAccount(userId) {
    db.profiles = db.profiles.filter(p => p.id !== userId)
    const mine = new Set(db.posts.filter(p => p.author_id === userId).map(p => p.id))
    db.posts = db.posts.filter(p => !mine.has(p.id))
    db.likes = db.likes.filter(l => l.user_id !== userId && !mine.has(l.post_id))
    db.comments = db.comments.filter(c => c.author_id !== userId && !mine.has(c.post_id))
    db.follows = db.follows.filter(f => f.follower_id !== userId && f.following_id !== userId)
    db.venues.forEach(v => { if (v.owner_id === userId) v.owner_id = null })
    db.notifications = db.notifications.filter(n => n.user_id !== userId && n.actor_id !== userId)
    db.conversations.forEach(c => { c.members = c.members.filter(m => m.user_id !== userId) })
    db.messages = db.messages.filter(m => m.sender_id !== userId)
    currentUser = ''
    return wait(undefined)
  },

  async getFeed(me, q, before) {
    const following = new Set([me, ...db.follows.filter(f => f.follower_id === me).map(f => f.following_id)])
    const authorType = (p: Post) => db.profiles.find(a => a.id === p.author_id)?.account_type
    const needle = q.search?.trim().toLowerCase()
    const rows = db.posts
      .filter(p => !q.reels || !!p.video_url)
      .filter(p => !q.withMedia || p.media.length > 0)
      .filter(p => !q.saved || db.saves.some(x => x.post_id === p.id && x.user_id === me))
      .filter(p => !needle || [p.title ?? '', p.body, db.profiles.find(a => a.id === p.author_id)?.name ?? ''].some(f => f.toLowerCase().includes(needle)))
      .filter(p => !blocked(p.author_id))
      .filter(p => !q.authorId || p.author_id === q.authorId || p.collab_id === q.authorId)
      .filter(p => !q.venueId || p.venue_id === q.venueId)
      .filter(p => !q.productId || p.product_id === q.productId)
      .filter(p => !q.remixOf || p.remix_of === q.remixOf)
      .filter(p => (q.groupId ? p.group_id === q.groupId : !p.group_id))
      .filter(p => {
        switch (q.tab) {
          case 'checkins': return p.kind === 'checkin'
          case 'rezepte': return p.kind === 'rezept'
          case 'neuheiten': return p.kind === 'neuheit'
          case 'jobs': return p.kind === 'job'
          case 'events': return p.kind === 'event'
          case 'handel': return ['haendler', 'lieferant', 'marke'].includes(authorType(p) ?? '')
          case 'gastro': return ['bar', 'restaurant'].includes(authorType(p) ?? '')
          case 'folge': return following.has(p.author_id)
          default: return true
        }
      })
      .filter(p => !before || q.sort === 'top' || p.created_at < before)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, q.sort === 'top' ? 60 : FEED_PAGE_SIZE)
      .map(toFeed)
    if (q.sort === 'top') rows.sort((a, b) => b.like_count - a.like_count)
    if (q.tab === 'fuerdich') {
      const meP = db.profiles.find(x => x.id === me)
      const liked = db.likes.filter(l => l.user_id === me).flatMap(l => db.posts.filter(x => x.id === l.post_id).map(x => x.category))
      return wait(rankPosts(rows, { me, following, city: meP?.city ?? '', liked }))
    }
    return wait(rows)
  },
  async getPost(id) {
    const p = db.posts.find(x => x.id === id)
    return wait(p && !blocked(p.author_id) ? toFeed(p) : null)
  },
  async createPost(me, p) {
    db.posts.push({
      id: uid(), author_id: me, kind: p.kind, title: p.title || null, body: p.body, category: p.category,
      link_url: p.link_url || null, venue_id: p.venue_id || null, created_at: new Date().toISOString(),
      media: (p.media ?? []).map(f => f.uri), image_url: p.media?.[0]?.uri ?? null, video_url: p.video?.uri ?? null, music: p.music ?? null,
      rating: p.rating ?? null, aromas: p.aromas ?? [], product_id: p.product_id ?? null, recipe: p.recipe ?? null, remix_of: p.remix_of ?? null,
      collab_id: p.collab_id ?? null, group_id: p.group_id ?? null, promoted: false, urgent: p.urgent ?? false, template: p.template ?? null, event_at: p.event_at ?? null,
    })
    const created = db.posts[db.posts.length - 1]
    if (p.group_id && !db.groupMembers.some(m => m.group_id === p.group_id && m.user_id === me)) {
      db.posts.pop()
      throw new Error('Tritt dem Raum zuerst bei.')
    }
    notifyMentions(`${p.title ?? ''} ${p.body}`, me, created.id)
    // Wie der Datenbank-Trigger: Neues von gemerkten Orten und passende Jobs melden
    if (created.venue_id && ['event', 'angebot', 'neuheit'].includes(created.kind)) {
      for (const sv of db.venueSaves.filter(x => x.venue_id === created.venue_id)) notify(sv.user_id, me, 'venue_post', created.id)
    }
    if (created.kind === 'job') {
      const city = db.profiles.find(x => x.id === me)?.city.toLowerCase()
      for (const pr of db.profiles) if (city && pr.open_to_work && pr.city.toLowerCase() === city) notify(pr.id, me, 'job_match', created.id)
    }
    return wait(undefined)
  },
  async deletePost(id) {
    db.posts = db.posts.filter(p => p.id !== id)
    return wait(undefined)
  },
  async setLike(me, postId, liked) {
    db.likes = db.likes.filter(l => !(l.post_id === postId && l.user_id === me))
    if (liked) {
      db.likes.push({ post_id: postId, user_id: me })
      const p = db.posts.find(x => x.id === postId)
      if (p) notify(p.author_id, me, 'like', postId)
    }
    return wait(undefined)
  },
  async getComments(postId) {
    const rows: FeedComment[] = db.comments
      .filter(c => c.post_id === postId && !blocked(c.author_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(c => {
        const a = db.profiles.find(x => x.id === c.author_id)!
        return {
          ...c, author_handle: a.handle, author_name: a.name, author_type: a.account_type, author_avatar_url: a.avatar_url,
          like_count: db.commentLikes.filter(l => l.comment_id === c.id).length,
          liked_by_me: db.commentLikes.some(l => l.comment_id === c.id && l.user_id === currentUser),
        }
      })
    return wait(rows)
  },
  async addComment(me, postId, body) {
    db.comments.push({ id: uid(), post_id: postId, author_id: me, body, created_at: new Date().toISOString() })
    const p = db.posts.find(x => x.id === postId)
    if (p) notify(p.author_id, me, 'comment', postId)
    notifyMentions(body, me, postId)
    return wait(undefined)
  },

  async getProfile(id) {
    const p = db.profiles.find(x => x.id === id)
    return wait(p ? strip(p) : null)
  },
  async getProfileStats(id) {
    if (!db.profiles.some(p => p.id === id)) return wait(null)
    return wait({
      id,
      post_count: db.posts.filter(p => p.author_id === id).length,
      follower_count: db.follows.filter(f => f.following_id === id).length,
      following_count: db.follows.filter(f => f.follower_id === id).length,
      followed_by_me: db.follows.some(f => f.follower_id === currentUser && f.following_id === id),
      blocked_by_me: db.blocks.some(b => b.blocker_id === currentUser && b.blocked_id === id),
    })
  },
  async searchProfiles({ types, search }) {
    const s = search?.trim().toLowerCase()
    return wait(db.profiles
      .filter(p => p.terms_accepted_at)
      .filter(p => !types?.length || types.includes(p.account_type))
      .filter(p => !s || [p.name, p.handle, p.city, p.headline, p.workplace].some(f => f.toLowerCase().includes(s)))
      .sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name))
      .map(strip))
  },
  async setFollow(me, id, follow) {
    db.follows = db.follows.filter(f => !(f.follower_id === me && f.following_id === id))
    if (follow) {
      db.follows.push({ follower_id: me, following_id: id })
      notify(id, me, 'follow')
    }
    return wait(undefined)
  },
  async setBlock(me, id, block) {
    db.blocks = db.blocks.filter(b => !(b.blocker_id === me && b.blocked_id === id))
    if (block) {
      db.blocks.push({ blocker_id: me, blocked_id: id })
      db.follows = db.follows.filter(f => !((f.follower_id === me && f.following_id === id) || (f.follower_id === id && f.following_id === me)))
    }
    return wait(undefined)
  },
  async report() {
    return wait(undefined)
  },

  async getVenues() {
    return wait([...db.venues].sort((a, b) => a.name.localeCompare(b.name)).map(toVenue))
  },
  async getVenue(id) {
    const v = db.venues.find(x => x.id === id)
    return wait(v ? toVenue(v) : null)
  },
  async createVenue(me, v) {
    const id = uid()
    db.venues.push({ ...v, id, owner_id: me, website: v.website ?? null, phone: v.phone ?? null, reservation_url: v.reservation_url ?? null, created_at: new Date().toISOString() })
    return wait(id)
  },

  async getNotifications() {
    const rows: AppNotification[] = db.notifications
      .filter(n => n.user_id === currentUser && !blocked(n.actor_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(n => {
        const a = db.profiles.find(x => x.id === n.actor_id)!
        const p = db.posts.find(x => x.id === n.post_id)
        return { ...n, actor_handle: a.handle, actor_name: a.name, actor_type: a.account_type, actor_avatar_url: a.avatar_url, post_snippet: p ? (p.title ?? p.body.slice(0, 80)) : null }
      })
    return wait(rows)
  },
  async markNotificationsRead() {
    const now = new Date().toISOString()
    db.notifications.forEach(n => { if (n.user_id === currentUser && !n.read_at) n.read_at = now })
    return wait(undefined)
  },

  async getConversations() {
    const rows: Conversation[] = db.conversations
      .filter(c => c.members.some(m => m.user_id === currentUser))
      .map((c): Conversation | null => {
        const me = c.members.find(m => m.user_id === currentUser)!
        const other = c.members.find(m => m.user_id !== currentUser)!
        const p = db.profiles.find(x => x.id === other.user_id)
        const msgs = db.messages.filter(m => m.conversation_id === c.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
        const last = msgs[msgs.length - 1]
        return p ? {
          id: c.id, last_message_at: last?.created_at ?? new Date().toISOString(),
          other_id: p.id, other_handle: p.handle, other_name: p.name, other_type: p.account_type, other_avatar_url: p.avatar_url, other_headline: p.headline,
          last_body: last?.body ?? null, last_sender_id: last?.sender_id ?? null,
          unread_count: msgs.filter(m => m.sender_id !== currentUser && m.created_at > me.last_read_at).length,
          blocked: blocked(p.id),
        } : null
      })
      .filter((c): c is Conversation => !!c)
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
    return wait(rows)
  },
  async startConversation(otherId) {
    if (otherId === currentUser) throw new Error('Du kannst dir nicht selbst schreiben.')
    if (blocked(otherId)) throw new Error('Mit diesem Profil ist kein Kontakt möglich.')
    const existing = db.conversations.find(c => c.members.some(m => m.user_id === currentUser) && c.members.some(m => m.user_id === otherId))
    if (existing) return wait(existing.id)
    const now = new Date().toISOString()
    const id = uid()
    db.conversations.push({ id, members: [{ user_id: currentUser, last_read_at: now }, { user_id: otherId, last_read_at: now }] })
    return wait(id)
  },
  async getMessages(conversationId) {
    return wait(db.messages.filter(m => m.conversation_id === conversationId).sort((a, b) => a.created_at.localeCompare(b.created_at)))
  },
  async sendMessage(me, conversationId, body) {
    const c = db.conversations.find(x => x.id === conversationId)
    const other = c?.members.find(m => m.user_id !== me)
    if (!c || (other && blocked(other.user_id))) throw new Error('Nachricht konnte nicht gesendet werden.')
    const now = new Date().toISOString()
    db.messages.push({ id: uid(), conversation_id: conversationId, sender_id: me, body, created_at: now })
    c.members.find(m => m.user_id === me)!.last_read_at = now
    return wait(undefined)
  },
  async markConversationRead(me, conversationId) {
    const m = db.conversations.find(x => x.id === conversationId)?.members.find(x => x.user_id === me)
    if (m) m.last_read_at = new Date().toISOString()
    return wait(undefined)
  },

  async setSave(me, postId, saved) {
    db.saves = db.saves.filter(x => !(x.user_id === me && x.post_id === postId))
    if (saved) db.saves.push({ user_id: me, post_id: postId })
    return wait(undefined)
  },

  async getStories(me) {
    const now = new Date().toISOString()
    return wait(groupStories(db.stories.filter(st => st.expires_at > now && !blocked(st.author_id)).map(st => toStory(st, me)), me))
  },
  async createStory(me, st) {
    const now = Date.now()
    db.stories.push({
      id: uid(), author_id: me, media_url: st.file.uri, media_type: st.media_type, caption: st.caption || null, venue_id: st.venue_id ?? null,
      music: st.music ?? null, overlays: st.overlays ?? [],
      created_at: new Date(now).toISOString(), expires_at: new Date(now + 86_400_000).toISOString(),
    })
    return wait(undefined)
  },
  async markStorySeen(me, storyId) {
    if (!db.storyViews.some(v => v.story_id === storyId && v.viewer_id === me)) db.storyViews.push({ story_id: storyId, viewer_id: me })
    return wait(undefined)
  },
  async deleteStory(storyId) {
    db.stories = db.stories.filter(st => st.id !== storyId)
    return wait(undefined)
  },

  async searchMusic(q) {
    const n = q.trim().toLowerCase()
    return wait(DEMO_TRACKS.filter(t => !n || `${t.title} ${t.artist}`.toLowerCase().includes(n)))
  },
  async getProfileByHandle(handle) {
    const p = db.profiles.find(x => x.handle === handle.toLowerCase())
    return wait(p ? strip(p) : null)
  },
  async setCommentLike(me, commentId, liked) {
    db.commentLikes = db.commentLikes.filter(l => !(l.comment_id === commentId && l.user_id === me))
    if (liked) db.commentLikes.push({ comment_id: commentId, user_id: me })
    return wait(undefined)
  },

  async getHighlights(ownerId) {
    return wait(db.highlights.filter(h => h.owner_id === ownerId && !blocked(ownerId)).map(({ stories: _s, ...h }): Highlight => h))
  },
  async getHighlightStories(highlightId) {
    const h = db.highlights.find(x => x.id === highlightId)
    if (!h) return wait([])
    return wait(h.stories.flatMap(sid => {
      const st = db.stories.find(x => x.id === sid)
      return st ? [{ ...toStory(st, currentUser), seen_by_me: true }] : []
    }))
  },
  async getStoryArchive(me) {
    return wait(db.stories.filter(st => st.author_id === me).sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ id, media_url, media_type, caption, created_at }) => ({ id, media_url, media_type, caption, created_at })))
  },
  async createHighlight(me, title, storyIds, coverUrl) {
    const id = uid()
    db.highlights.push({ id, owner_id: me, title, cover_url: coverUrl, created_at: new Date().toISOString(), stories: storyIds })
    return wait(id)
  },
  async deleteHighlight(id) {
    db.highlights = db.highlights.filter(h => h.id !== id)
    return wait(undefined)
  },

  async setVenueSave(me, venueId, saved) {
    db.venueSaves = db.venueSaves.filter(x => !(x.user_id === me && x.venue_id === venueId))
    if (saved) db.venueSaves.push({ user_id: me, venue_id: venueId })
    return wait(undefined)
  },
  async getSavedVenues() {
    return wait(db.venues.filter(v => db.venueSaves.some(x => x.venue_id === v.id && x.user_id === currentUser)).map(toVenue))
  },
  async getVenueStories(venueId) {
    const now = new Date().toISOString()
    return wait(db.stories.filter(st => st.venue_id === venueId && st.expires_at > now && !blocked(st.author_id)).map(st => toStory(st, currentUser)))
  },
  async updateVenue(id, data) {
    Object.assign(db.venues.find(v => v.id === id)!, data)
    return wait(undefined)
  },

  async getProducts(search) {
    const n = search?.trim().toLowerCase()
    return wait(db.products.filter(pr => !n || `${pr.name} ${pr.brand_name}`.toLowerCase().includes(n)).map(toProduct).sort((a, b) => b.checkin_count - a.checkin_count))
  },
  async getProduct(id) {
    const pr = db.products.find(x => x.id === id)
    return wait(pr ? toProduct(pr) : null)
  },
  async createProduct(me, p) {
    const id = uid()
    db.products.push({ id, name: p.name, brand_name: p.brand_name, brand_id: p.brand_id ?? null, category: p.category, description: '', shop_url: null, image_url: null, created_at: new Date().toISOString() })
    return wait(id)
  },
  async getCheckinSummary(userId) {
    return wait(summarize(db.posts.filter(p => p.author_id === userId).map(p => ({ ...p, venue_city: db.venues.find(v => v.id === p.venue_id)?.city ?? null }))))
  },

  async getGroups() {
    return wait(db.groups.map(toGroup).sort((a, b) => b.member_count - a.member_count))
  },
  async getGroup(id) {
    const g = db.groups.find(x => x.id === id)
    return wait(g ? toGroup(g) : null)
  },
  async createGroup(me, g) {
    const id = uid()
    db.groups.push({ id, ...g, starts_at: g.starts_at ?? null, created_by: me, created_at: new Date().toISOString() })
    db.groupMembers.push({ group_id: id, user_id: me })
    return wait(id)
  },
  async setGroupMember(me, groupId, join) {
    db.groupMembers = db.groupMembers.filter(m => !(m.group_id === groupId && m.user_id === me))
    if (join) db.groupMembers.push({ group_id: groupId, user_id: me })
    return wait(undefined)
  },

  async getCollections() {
    return wait(db.collections.filter(c => canSeeCollection(c.id)).map(toCollection).sort((a, b) => b.created_at.localeCompare(a.created_at)))
  },
  async getCollection(id) {
    const c = db.collections.find(x => x.id === id)
    return wait(c && canSeeCollection(id) ? toCollection(c) : null)
  },
  async createCollection(me, name) {
    const id = uid()
    db.collections.push({ id, owner_id: me, name, created_at: new Date().toISOString() })
    return wait(id)
  },
  async deleteCollection(id) {
    db.collections = db.collections.filter(c => c.id !== id)
    db.collectionItems = db.collectionItems.filter(i => i.collection_id !== id)
    return wait(undefined)
  },
  async getCollectionItems(id) {
    if (!canSeeCollection(id)) return wait([])
    return wait(db.collectionItems.filter(i => i.collection_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)).flatMap((i): CollectionItem[] => {
      const post = db.posts.find(p => p.id === i.post_id)
      const venue = db.venues.find(v => v.id === i.venue_id)
      return post ? [{ id: i.id, created_at: i.created_at, post: toFeed(post) }] : venue ? [{ id: i.id, created_at: i.created_at, venue: toVenue(venue) }] : []
    }))
  },
  async addToCollection(_me, id, target) {
    const key = target.postId ?? target.venueId
    if (!db.collectionItems.some(i => i.collection_id === id && (i.post_id ?? i.venue_id) === key)) {
      db.collectionItems.push({ id: uid(), collection_id: id, post_id: target.postId ?? null, venue_id: target.venueId ?? null, created_at: new Date().toISOString() })
    }
    return wait(undefined)
  },
  async removeFromCollection(itemId) {
    db.collectionItems = db.collectionItems.filter(i => i.id !== itemId)
    return wait(undefined)
  },
  async addCollectionMember(id, profileId) {
    if (!db.collectionMembers.some(m => m.collection_id === id && m.user_id === profileId)) db.collectionMembers.push({ collection_id: id, user_id: profileId })
    return wait(undefined)
  },

  async getStoryVotes(storyId) {
    return wait(tally(db.storyVotes.filter(v => v.story_id === storyId), currentUser))
  },
  async voteStory(me, storyId, sticker, option) {
    if (!db.storyVotes.some(v => v.story_id === storyId && v.user_id === me && v.sticker === sticker)) db.storyVotes.push({ story_id: storyId, user_id: me, sticker, option })
    return wait(undefined)
  },

  async recordProfileView(me, profileId) {
    const day = new Date().toISOString().slice(0, 10)
    if (me !== profileId && !db.profileViews.some(v => v.profile_id === profileId && v.viewer_id === me && v.day === day)) db.profileViews.push({ profile_id: profileId, viewer_id: me, day })
    return wait(undefined)
  },
  async getBusinessStats(profileId) {
    const since = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)
    const views = db.profileViews.filter(v => v.profile_id === profileId)
    const list = db.posts.filter(p => p.author_id === profileId).map(toFeed)
    // Beispielwerte, damit die Statistik in der Demo nicht leer ist
    const seeded = 37 + list.length * 9
    return wait(businessStats(list, {
      views_7d: views.filter(v => v.day >= since(7)).length + seeded,
      views_30d: views.filter(v => v.day >= since(30)).length + seeded * 4,
      followers: db.follows.filter(f => f.following_id === profileId).length,
      saves: db.saves.filter(x => list.some(p => p.id === x.post_id)).length,
    }))
  },
  async setPromoted(postId, promoted) {
    const p = db.posts.find(x => x.id === postId)
    if (p) p.promoted = promoted
    return wait(undefined)
  },

  async getVenueActivity(me) {
    const day = new Date(Date.now() - 86_400_000).toISOString()
    const now = new Date().toISOString()
    const following = new Set(db.follows.filter(f => f.follower_id === me).map(f => f.following_id))
    return activity(
      db.posts.filter(p => p.venue_id && p.created_at >= day).map(p => ({ venue_id: p.venue_id!, kind: p.kind, author_id: p.author_id, created_at: p.created_at })),
      db.stories.filter(st => st.venue_id && st.expires_at > now).map(st => ({ venue_id: st.venue_id! })),
      following,
      async id => db.profiles.find(x => x.id === id)?.name ?? '',
    )
  },
}
