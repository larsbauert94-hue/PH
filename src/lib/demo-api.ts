// In-Memory-Backend für den Demo-Modus (ohne Supabase-Zugangsdaten).
// Verhält sich wie die Supabase-Views, damit die App identisch funktioniert.
import type { Api } from './api'
import type { AppNotification, Conversation, FeedComment, FeedPost, Message, NotificationType, Post, Profile, Venue } from './types'
import { FEED_PAGE_SIZE } from './types'
import { seedComments, seedConversations, seedFollows, seedLikes, seedPosts, seedProfiles, seedVenues } from './demo-data'

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const uid = () => `demo-${Math.random().toString(36).slice(2, 10)}`
const wait = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 120))

const db = {
  profiles: seedProfiles.map(({ email: _email, ...p }) => ({
    ...p, avatar_url: null as string | null, created_at: ago(24 * 90), terms_accepted_at: ago(24 * 90) as string | null,
  })),
  venues: seedVenues.map(v => ({ ...v, created_at: ago(24 * 60) })) as Venue[],
  posts: seedPosts.map(({ hoursAgo, ...p }) => ({ ...p, image_url: null, created_at: ago(hoursAgo) })) as Post[],
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
  }
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
    const rows = db.posts
      .filter(p => !blocked(p.author_id))
      .filter(p => !q.authorId || p.author_id === q.authorId)
      .filter(p => !q.venueId || p.venue_id === q.venueId)
      .filter(p => {
        switch (q.tab) {
          case 'neuheiten': return p.kind === 'neuheit'
          case 'jobs': return p.kind === 'job'
          case 'events': return p.kind === 'event'
          case 'handel': return ['haendler', 'lieferant', 'marke'].includes(authorType(p) ?? '')
          case 'gastro': return ['bar', 'restaurant'].includes(authorType(p) ?? '')
          case 'folge': return following.has(p.author_id)
          default: return true
        }
      })
      .filter(p => !before || p.created_at < before)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, FEED_PAGE_SIZE)
      .map(toFeed)
    return wait(rows)
  },
  async getPost(id) {
    const p = db.posts.find(x => x.id === id)
    return wait(p && !blocked(p.author_id) ? toFeed(p) : null)
  },
  async createPost(me, p) {
    db.posts.push({
      id: uid(), author_id: me, kind: p.kind, title: p.title || null, body: p.body, category: p.category,
      link_url: p.link_url || null, venue_id: p.venue_id || null, image_url: p.imageUri ?? null, created_at: new Date().toISOString(),
    })
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
        return { ...c, author_handle: a.handle, author_name: a.name, author_type: a.account_type, author_avatar_url: a.avatar_url }
      })
    return wait(rows)
  },
  async addComment(me, postId, body) {
    db.comments.push({ id: uid(), post_id: postId, author_id: me, body, created_at: new Date().toISOString() })
    const p = db.posts.find(x => x.id === postId)
    if (p) notify(p.author_id, me, 'comment', postId)
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
    return wait([...db.venues].sort((a, b) => a.name.localeCompare(b.name)))
  },
  async getVenue(id) {
    return wait(db.venues.find(v => v.id === id) ?? null)
  },
  async createVenue(me, v) {
    const id = uid()
    db.venues.push({ ...v, id, owner_id: me, website: v.website ?? null, phone: v.phone ?? null, created_at: new Date().toISOString() })
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
}
