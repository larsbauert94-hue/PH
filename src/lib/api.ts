import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { isDemo, supabase } from './supabase'
import { demoApi } from './demo-api'
import type {
  FeedComment, FeedPost, FeedQuery, NewPost, NewVenue, Profile, ProfileStats, ProfileUpdate, Venue, AccountType,
  AppNotification, Conversation, Message, LocalFile, NewStory, StoryGroup, Story,
} from './types'
import { groupStories } from './stories'
import { FEED_PAGE_SIZE } from './types'

export interface OnboardingData {
  name: string
  handle: string
  account_type: AccountType
  headline: string
  workplace: string
  city: string
}

export interface Api {
  getMyProfile(userId: string): Promise<(Profile & { terms_accepted_at: string | null }) | null>
  completeOnboarding(data: OnboardingData): Promise<void>
  updateProfile(userId: string, data: ProfileUpdate): Promise<void>
  deleteAccount(userId: string): Promise<void>
  /** Lädt ein Profilbild hoch und setzt es am Profil; gibt die neue URL zurück */
  uploadAvatar(userId: string, uri: string, mime?: string): Promise<string>

  /** Eine Seite des Feeds; `before` = created_at des letzten geladenen Beitrags */
  getFeed(me: string, q: FeedQuery, before?: string): Promise<FeedPost[]>
  getPost(id: string): Promise<FeedPost | null>
  createPost(me: string, post: NewPost): Promise<void>
  deletePost(id: string): Promise<void>
  setLike(me: string, postId: string, liked: boolean): Promise<void>
  getComments(postId: string): Promise<FeedComment[]>
  addComment(me: string, postId: string, body: string): Promise<void>

  getProfile(id: string): Promise<Profile | null>
  getProfileStats(id: string): Promise<ProfileStats | null>
  searchProfiles(q: { types?: AccountType[]; search?: string }): Promise<Profile[]>
  setFollow(me: string, id: string, follow: boolean): Promise<void>
  setBlock(me: string, id: string, block: boolean): Promise<void>
  report(me: string, target: { postId?: string; profileId?: string }, reason: string): Promise<void>

  getVenues(): Promise<Venue[]>
  getVenue(id: string): Promise<Venue | null>
  createVenue(me: string, v: NewVenue): Promise<string>

  getNotifications(): Promise<AppNotification[]>
  markNotificationsRead(): Promise<void>

  getConversations(): Promise<Conversation[]>
  /** Unterhaltung mit einer Person öffnen (bestehende oder neue); gibt die ID zurück */
  startConversation(otherId: string): Promise<string>
  getMessages(conversationId: string): Promise<Message[]>
  sendMessage(me: string, conversationId: string, body: string): Promise<void>
  markConversationRead(me: string, conversationId: string): Promise<void>

  setSave(me: string, postId: string, saved: boolean): Promise<void>

  getStories(me: string): Promise<StoryGroup[]>
  createStory(me: string, story: NewStory): Promise<void>
  markStorySeen(me: string, storyId: string): Promise<void>
  deleteStory(storyId: string): Promise<void>
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Wie check, aber für Listen: liefert immer ein Array */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return check(res) ?? []
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }

async function uploadImage(me: string, uri: string, mime = 'image/jpeg') {
  const sb = supabase!
  const ext = EXT[mime] ?? mime.split('/')[1] ?? 'bin'
  const path = `${me}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const body = Platform.OS === 'web' ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer()
  check(await sb.storage.from('media').upload(path, body, { contentType: mime }))
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl
}

const supabaseApi: Api = {
  async getMyProfile(userId) {
    return check(await supabase!.from('profiles').select('*').eq('id', userId).maybeSingle())
  },
  async completeOnboarding(d) {
    check(await supabase!.rpc('complete_onboarding', {
      p_name: d.name, p_handle: d.handle, p_account_type: d.account_type,
      p_headline: d.headline, p_workplace: d.workplace, p_city: d.city,
    }))
  },
  async updateProfile(userId, data) {
    check(await supabase!.from('profiles').update(data).eq('id', userId))
  },
  async deleteAccount(userId) {
    const sb = supabase!
    // Eigene Bilder zuerst entfernen, danach Account samt aller Daten löschen
    const files = rows(await sb.storage.from('media').list(userId, { limit: 1000 }))
    if (files.length) check(await sb.storage.from('media').remove(files.map(f => `${userId}/${f.name}`)))
    check(await sb.rpc('delete_account'))
    await sb.auth.signOut()
  },
  async uploadAvatar(userId, uri, mime) {
    const url = await uploadImage(userId, uri, mime)
    check(await supabase!.from('profiles').update({ avatar_url: url }).eq('id', userId))
    return url
  },

  async getFeed(me, q, before) {
    let query = supabase!.from('feed').select('*').order('created_at', { ascending: false }).limit(FEED_PAGE_SIZE)
    if (before) query = query.lt('created_at', before)
    if (q.reels) query = query.not('video_url', 'is', null)
    if (q.withMedia) query = query.neq('media', '{}')
    if (q.saved) query = query.eq('saved_by_me', true)
    const s = q.search?.trim().replace(/[%,()]/g, '')
    if (s) query = s.startsWith('#') ? query.ilike('body', `%${s}%`) : query.or(`title.ilike.%${s}%,body.ilike.%${s}%,author_name.ilike.%${s}%`)
    if (q.authorId) query = query.eq('author_id', q.authorId)
    if (q.venueId) query = query.eq('venue_id', q.venueId)
    switch (q.tab) {
      case 'neuheiten': query = query.eq('kind', 'neuheit'); break
      case 'jobs': query = query.eq('kind', 'job'); break
      case 'events': query = query.eq('kind', 'event'); break
      case 'handel': query = query.in('author_type', ['haendler', 'lieferant', 'marke']); break
      case 'gastro': query = query.in('author_type', ['bar', 'restaurant']); break
      case 'folge': {
        const follows = rows(await supabase!.from('follows').select('following_id').eq('follower_id', me))
        query = query.in('author_id', [me, ...follows.map(f => f.following_id)])
        break
      }
    }
    return rows<FeedPost>(await query)
  },
  async getPost(id) {
    return check(await supabase!.from('feed').select('*').eq('id', id).maybeSingle()) as FeedPost | null
  },
  async createPost(me, p) {
    const upload = (f: LocalFile) => uploadImage(me, f.uri, f.mime)
    const [media, video_url] = await Promise.all([
      Promise.all((p.media ?? []).map(upload)),
      p.video ? upload(p.video) : Promise.resolve(null),
    ])
    check(await supabase!.from('posts').insert({
      author_id: me, kind: p.kind, title: p.title || null, body: p.body, category: p.category,
      link_url: p.link_url || null, venue_id: p.venue_id || null, media, image_url: media[0] ?? null, video_url,
    }))
  },
  async deletePost(id) {
    check(await supabase!.from('posts').delete().eq('id', id))
  },
  async setLike(me, postId, liked) {
    const t = supabase!.from('likes')
    check(await (liked ? t.upsert({ post_id: postId, user_id: me }) : t.delete().match({ post_id: postId, user_id: me })))
  },
  async getComments(postId) {
    return rows<FeedComment>(await supabase!.from('comment_feed').select('*').eq('post_id', postId).order('created_at'))
  },
  async addComment(me, postId, body) {
    check(await supabase!.from('comments').insert({ post_id: postId, author_id: me, body }))
  },

  async getProfile(id) {
    return check(await supabase!.from('profiles').select('*').eq('id', id).maybeSingle())
  },
  async getProfileStats(id) {
    return check(await supabase!.from('profile_stats').select('*').eq('id', id).maybeSingle())
  },
  async searchProfiles({ types, search }) {
    let q = supabase!.from('profiles').select('*').not('terms_accepted_at', 'is', null).order('verified', { ascending: false }).order('name').limit(100)
    if (types?.length) q = q.in('account_type', types)
    const s = search?.trim().replace(/[%,()]/g, '')
    if (s) q = q.or(`name.ilike.%${s}%,handle.ilike.%${s}%,city.ilike.%${s}%,headline.ilike.%${s}%,workplace.ilike.%${s}%`)
    return rows<Profile>(await q)
  },
  async setFollow(me, id, follow) {
    const t = supabase!.from('follows')
    check(await (follow ? t.upsert({ follower_id: me, following_id: id }) : t.delete().match({ follower_id: me, following_id: id })))
  },
  async setBlock(me, id, block) {
    const t = supabase!.from('blocks')
    check(await (block ? t.upsert({ blocker_id: me, blocked_id: id }) : t.delete().match({ blocker_id: me, blocked_id: id })))
  },
  async report(me, target, reason) {
    check(await supabase!.from('reports').insert({ reporter_id: me, post_id: target.postId ?? null, profile_id: target.profileId ?? null, reason }))
  },

  async getVenues() {
    return rows<Venue>(await supabase!.from('venues').select('*').order('name'))
  },
  async getVenue(id) {
    return check(await supabase!.from('venues').select('*').eq('id', id).maybeSingle())
  },
  async createVenue(me, v) {
    const row = check(await supabase!.from('venues').insert({ ...v, owner_id: me }).select('id').single())
    return (row as { id: string }).id
  },

  async getNotifications() {
    return rows<AppNotification>(await supabase!.from('notification_feed').select('*').order('created_at', { ascending: false }).limit(100))
  },
  async markNotificationsRead() {
    check(await supabase!.rpc('mark_notifications_read'))
  },

  async getConversations() {
    return rows<Conversation>(await supabase!.from('my_conversations').select('*').order('last_message_at', { ascending: false }))
  },
  async startConversation(otherId) {
    return check(await supabase!.rpc('start_conversation', { other: otherId })) as string
  },
  async getMessages(conversationId) {
    return rows<Message>(await supabase!.from('messages').select('*').eq('conversation_id', conversationId).order('created_at').limit(500))
  },
  async sendMessage(me, conversationId, body) {
    check(await supabase!.from('messages').insert({ conversation_id: conversationId, sender_id: me, body }))
  },
  async markConversationRead(me, conversationId) {
    check(await supabase!.from('conversation_members').update({ last_read_at: new Date().toISOString() }).match({ conversation_id: conversationId, user_id: me }))
  },

  async setSave(me, postId, saved) {
    const t = supabase!.from('saves')
    check(await (saved ? t.upsert({ user_id: me, post_id: postId }) : t.delete().match({ user_id: me, post_id: postId })))
  },

  async getStories(me) {
    return groupStories(rows<Story>(await supabase!.from('story_feed').select('*').order('created_at').limit(500)), me)
  },
  async createStory(me, st) {
    const media_url = await uploadImage(me, st.file.uri, st.file.mime)
    check(await supabase!.from('stories').insert({ author_id: me, media_url, media_type: st.media_type, caption: st.caption || null, venue_id: st.venue_id || null }))
  },
  async markStorySeen(me, storyId) {
    check(await supabase!.from('story_views').upsert({ story_id: storyId, viewer_id: me }, { ignoreDuplicates: true }))
  },
  async deleteStory(storyId) {
    check(await supabase!.from('stories').delete().eq('id', storyId))
  },
}

export const api: Api = isDemo ? demoApi : supabaseApi
