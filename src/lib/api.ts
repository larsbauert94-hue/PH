import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { isDemo, supabase } from './supabase'
import { demoApi } from './demo-api'
import type {
  FeedComment, FeedPost, FeedQuery, NewPost, NewVenue, Profile, ProfileStats, ProfileUpdate, Venue, AccountType,
} from './types'

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

  getFeed(me: string, q: FeedQuery): Promise<FeedPost[]>
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
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Wie check, aber für Listen: liefert immer ein Array */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return check(res) ?? []
}

async function uploadImage(me: string, uri: string, mime = 'image/jpeg') {
  const sb = supabase!
  const ext = mime.split('/')[1] ?? 'jpg'
  const path = `${me}/${Date.now()}.${ext}`
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

  async getFeed(me, q) {
    let query = supabase!.from('feed').select('*').order('created_at', { ascending: false }).limit(100)
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
    const image_url = p.imageUri ? await uploadImage(me, p.imageUri, p.imageMime) : null
    check(await supabase!.from('posts').insert({
      author_id: me, kind: p.kind, title: p.title || null, body: p.body, category: p.category,
      link_url: p.link_url || null, venue_id: p.venue_id || null, image_url,
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
}

export const api: Api = isDemo ? demoApi : supabaseApi
