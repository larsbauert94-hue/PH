import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { isDemo, supabase } from './supabase'
import { demoApi } from './demo-api'
import type {
  FeedComment, FeedPost, FeedQuery, NewPost, NewVenue, Profile, ProfileStats, ProfileUpdate, Venue, AccountType,
  AppNotification, Conversation, Message, LocalFile, NewStory, StoryGroup, Story, Track, Highlight,
  Product, NewProduct, Group, NewGroup, Collection, CollectionItem, StoryVotes, BusinessStats, VenueActivity, CheckinSummary,
  Category,
} from './types'
import { FEED_PAGE_SIZE } from './types'
import { groupStories } from './stories'
import { activity, businessStats, rankPosts, summarize, tally } from './insights'

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

  searchMusic(q: string): Promise<Track[]>
  getProfileByHandle(handle: string): Promise<Profile | null>
  setCommentLike(me: string, commentId: string, liked: boolean): Promise<void>

  getHighlights(ownerId: string): Promise<Highlight[]>
  getHighlightStories(highlightId: string): Promise<Story[]>
  /** Eigene Storys inkl. abgelaufener, neueste zuerst */
  getStoryArchive(me: string): Promise<ArchivedStory[]>
  createHighlight(me: string, title: string, storyIds: string[], coverUrl: string | null): Promise<string>
  deleteHighlight(id: string): Promise<void>

  setVenueSave(me: string, venueId: string, saved: boolean): Promise<void>
  getSavedVenues(): Promise<Venue[]>
  /** Aktive Storys, die an diesem Ort markiert sind */
  getVenueStories(venueId: string): Promise<Story[]>
  updateVenue(id: string, data: Partial<NewVenue>): Promise<void>

  // Produkte und Check-ins
  getProducts(search?: string): Promise<Product[]>
  getProduct(id: string): Promise<Product | null>
  createProduct(me: string, p: NewProduct): Promise<string>
  getCheckinSummary(userId: string): Promise<CheckinSummary>

  // Räume
  getGroups(): Promise<Group[]>
  getGroup(id: string): Promise<Group | null>
  createGroup(me: string, g: NewGroup): Promise<string>
  setGroupMember(me: string, groupId: string, join: boolean): Promise<void>

  // Gemeinsame Sammlungen
  getCollections(): Promise<Collection[]>
  getCollection(id: string): Promise<Collection | null>
  createCollection(me: string, name: string): Promise<string>
  deleteCollection(id: string): Promise<void>
  getCollectionItems(id: string): Promise<CollectionItem[]>
  addToCollection(me: string, id: string, target: { postId?: string; venueId?: string }): Promise<void>
  removeFromCollection(itemId: string): Promise<void>
  addCollectionMember(id: string, profileId: string): Promise<void>

  // Story-Umfragen und -Quiz
  getStoryVotes(storyId: string): Promise<StoryVotes>
  voteStory(me: string, storyId: string, sticker: number, option: number): Promise<void>

  // Betriebe (Pour Pro)
  recordProfileView(me: string, profileId: string): Promise<void>
  getBusinessStats(profileId: string): Promise<BusinessStats>
  setPromoted(postId: string, promoted: boolean): Promise<void>

  /** Karte „Heute“: was an Orten los ist */
  getVenueActivity(me: string): Promise<VenueActivity[]>
}

export type ArchivedStory = Pick<Story, 'id' | 'media_url' | 'media_type' | 'caption' | 'created_at'>

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Wie check, aber für Listen: liefert immer ein Array */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return check(res) ?? []
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }

/** data:-URI (z. B. aus dem Foto-Editor) in Bytes umwandeln */
function dataUriToBytes(uri: string) {
  const bin = atob(uri.slice(uri.indexOf(',') + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function uploadImage(me: string, uri: string, mime = 'image/jpeg') {
  const sb = supabase!
  const ext = EXT[mime] ?? mime.split('/')[1] ?? 'bin'
  const path = `${me}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const body = uri.startsWith('data:') ? dataUriToBytes(uri)
    : Platform.OS === 'web' ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer()
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
    // „Top“: nach Likes sortiert, ohne Nachladen (eine Seite)
    let query = q.sort === 'top'
      ? supabase!.from('feed').select('*').order('like_count', { ascending: false }).order('created_at', { ascending: false }).limit(60)
      : supabase!.from('feed').select('*').order('created_at', { ascending: false }).limit(FEED_PAGE_SIZE)
    if (before && q.sort !== 'top') query = query.lt('created_at', before)
    if (q.reels) query = query.not('video_url', 'is', null)
    if (q.withMedia) query = query.neq('media', '{}')
    if (q.saved) query = query.eq('saved_by_me', true)
    const s = q.search?.trim().replace(/[%,()]/g, '')
    if (s) query = s.startsWith('#') ? query.ilike('body', `%${s}%`) : query.or(`title.ilike.%${s}%,body.ilike.%${s}%,author_name.ilike.%${s}%`)
    // Kollaborationen erscheinen bei beiden Profilen
    if (q.authorId) query = query.or(`author_id.eq.${q.authorId},collab_id.eq.${q.authorId}`)
    if (q.venueId) query = query.eq('venue_id', q.venueId)
    if (q.productId) query = query.eq('product_id', q.productId)
    if (q.remixOf) query = query.eq('remix_of', q.remixOf)
    // Raum-Beiträge nur im jeweiligen Raum
    query = q.groupId ? query.eq('group_id', q.groupId) : query.is('group_id', null)
    switch (q.tab) {
      case 'checkins': query = query.eq('kind', 'checkin'); break
      case 'rezepte': query = query.eq('kind', 'rezept'); break
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
    const list = rows<FeedPost>(await query)
    return q.tab === 'fuerdich' ? await rankForYou(me, list) : list
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
      link_url: p.link_url || null, venue_id: p.venue_id || null, media, image_url: media[0] ?? null, video_url, music: p.music ?? null,
      rating: p.rating ?? null, aromas: p.aromas ?? [], product_id: p.product_id || null, recipe: p.recipe ?? null,
      remix_of: p.remix_of || null, collab_id: p.collab_id || null, group_id: p.group_id || null,
      urgent: p.urgent ?? false, template: p.template ?? null, event_at: p.event_at ?? null,
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
    return rows<Venue>(await supabase!.from('venue_feed').select('*').order('name'))
  },
  async getVenue(id) {
    return check(await supabase!.from('venue_feed').select('*').eq('id', id).maybeSingle())
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
    check(await supabase!.from('stories').insert({
      author_id: me, media_url, media_type: st.media_type, caption: st.caption || null, venue_id: st.venue_id || null,
      music: st.music ?? null, overlays: st.overlays ?? [],
    }))
  },
  async markStorySeen(me, storyId) {
    check(await supabase!.from('story_views').upsert({ story_id: storyId, viewer_id: me }, { ignoreDuplicates: true }))
  },
  async deleteStory(storyId) {
    check(await supabase!.from('stories').delete().eq('id', storyId))
  },

  async searchMusic(q) {
    const { data, error } = await supabase!.functions.invoke('spotify-search', { body: { q } })
    if (error) throw new Error('Die Musiksuche ist gerade nicht erreichbar.')
    return (data as { tracks: Track[] }).tracks ?? []
  },
  async getProfileByHandle(handle) {
    return check(await supabase!.from('profiles').select('*').eq('handle', handle.toLowerCase()).maybeSingle())
  },
  async setCommentLike(me, commentId, liked) {
    const t = supabase!.from('comment_likes')
    check(await (liked ? t.upsert({ comment_id: commentId, user_id: me }) : t.delete().match({ comment_id: commentId, user_id: me })))
  },

  async getHighlights(ownerId) {
    return rows<Highlight>(await supabase!.from('highlights').select('*').eq('owner_id', ownerId).order('created_at'))
  },
  async getHighlightStories(highlightId) {
    return rows<Story>(await supabase!.from('highlight_story_feed').select('*').eq('highlight_id', highlightId).order('position'))
  },
  async getStoryArchive() {
    return rows<ArchivedStory>(await supabase!.from('my_story_archive').select('id, media_url, media_type, caption, created_at').order('created_at', { ascending: false }).limit(200))
  },
  async createHighlight(me, title, storyIds, coverUrl) {
    const h = check(await supabase!.from('highlights').insert({ owner_id: me, title, cover_url: coverUrl }).select('id').single()) as { id: string }
    check(await supabase!.from('highlight_stories').insert(storyIds.map((story_id, position) => ({ highlight_id: h.id, story_id, position }))))
    return h.id
  },
  async deleteHighlight(id) {
    check(await supabase!.from('highlights').delete().eq('id', id))
  },

  async setVenueSave(me, venueId, saved) {
    const t = supabase!.from('venue_saves')
    check(await (saved ? t.upsert({ user_id: me, venue_id: venueId }) : t.delete().match({ user_id: me, venue_id: venueId })))
  },
  async getSavedVenues() {
    return rows<Venue>(await supabase!.from('venue_feed').select('*').eq('saved_by_me', true).order('name'))
  },
  async getVenueStories(venueId) {
    return rows<Story>(await supabase!.from('story_feed').select('*').eq('venue_id', venueId).order('created_at'))
  },
  async updateVenue(id, data) {
    check(await supabase!.from('venues').update(data).eq('id', id))
  },

  async getProducts(search) {
    let q = supabase!.from('product_feed').select('*').order('checkin_count', { ascending: false }).limit(50)
    const s = search?.trim().replace(/[%,()]/g, '')
    if (s) q = q.or(`name.ilike.%${s}%,brand_name.ilike.%${s}%`)
    return rows<Product>(await q)
  },
  async getProduct(id) {
    return check(await supabase!.from('product_feed').select('*').eq('id', id).maybeSingle()) as Product | null
  },
  async createProduct(me, p) {
    const row = check(await supabase!.from('products').insert({ ...p, brand_id: p.brand_id ?? null, created_by: me }).select('id').single()) as { id: string }
    return row.id
  },
  async getCheckinSummary(userId) {
    const posts = rows<{ kind: string; venue_id: string | null; product_id: string | null; category: Category; rating: number | null; remix_of: string | null; venue_city: string | null }>(
      await supabase!.from('feed').select('kind, venue_id, product_id, category, rating, remix_of, venue_city').eq('author_id', userId).limit(1000))
    return summarize(posts)
  },

  async getGroups() {
    return rows<Group>(await supabase!.from('group_feed').select('*').order('member_count', { ascending: false }))
  },
  async getGroup(id) {
    return check(await supabase!.from('group_feed').select('*').eq('id', id).maybeSingle()) as Group | null
  },
  async createGroup(me, g) {
    const row = check(await supabase!.from('groups').insert({ ...g, starts_at: g.starts_at ?? null, created_by: me }).select('id').single()) as { id: string }
    check(await supabase!.from('group_members').insert({ group_id: row.id, user_id: me }))
    return row.id
  },
  async setGroupMember(me, groupId, join) {
    const t = supabase!.from('group_members')
    check(await (join ? t.upsert({ group_id: groupId, user_id: me }) : t.delete().match({ group_id: groupId, user_id: me })))
  },

  async getCollections() {
    return rows<Collection>(await supabase!.from('collection_feed').select('*').order('created_at', { ascending: false }))
  },
  async getCollection(id) {
    return check(await supabase!.from('collection_feed').select('*').eq('id', id).maybeSingle()) as Collection | null
  },
  async createCollection(me, name) {
    const row = check(await supabase!.from('collections').insert({ owner_id: me, name }).select('id').single()) as { id: string }
    return row.id
  },
  async deleteCollection(id) {
    check(await supabase!.from('collections').delete().eq('id', id))
  },
  async getCollectionItems(id) {
    const items = rows<{ id: string; created_at: string; post_id: string | null; venue_id: string | null }>(
      await supabase!.from('collection_items').select('id, created_at, post_id, venue_id').eq('collection_id', id).order('created_at', { ascending: false }))
    const postIds = items.flatMap(i => i.post_id ? [i.post_id] : [])
    const venueIds = items.flatMap(i => i.venue_id ? [i.venue_id] : [])
    const [posts, venues] = await Promise.all([
      postIds.length ? supabase!.from('feed').select('*').in('id', postIds).then(r => rows<FeedPost>(r)) : Promise.resolve([] as FeedPost[]),
      venueIds.length ? supabase!.from('venue_feed').select('*').in('id', venueIds).then(r => rows<Venue>(r)) : Promise.resolve([] as Venue[]),
    ])
    return items.flatMap((i): CollectionItem[] => {
      const post = posts.find(p => p.id === i.post_id)
      const venue = venues.find(v => v.id === i.venue_id)
      return post ? [{ id: i.id, created_at: i.created_at, post }] : venue ? [{ id: i.id, created_at: i.created_at, venue }] : []
    })
  },
  async addToCollection(me, id, target) {
    check(await supabase!.from('collection_items').insert({ collection_id: id, post_id: target.postId ?? null, venue_id: target.venueId ?? null, added_by: me }))
  },
  async removeFromCollection(itemId) {
    check(await supabase!.from('collection_items').delete().eq('id', itemId))
  },
  async addCollectionMember(id, profileId) {
    check(await supabase!.from('collection_members').upsert({ collection_id: id, user_id: profileId }))
  },

  async getStoryVotes(storyId) {
    const me = (await supabase!.auth.getUser()).data.user?.id
    return tally(rows<{ user_id: string; sticker: number; option: number }>(await supabase!.from('story_votes').select('user_id, sticker, option').eq('story_id', storyId)), me)
  },
  async voteStory(me, storyId, sticker, option) {
    check(await supabase!.from('story_votes').insert({ story_id: storyId, user_id: me, sticker, option }))
  },

  async recordProfileView(me, profileId) {
    if (me === profileId) return
    await supabase!.from('profile_views').upsert({ profile_id: profileId, viewer_id: me }, { ignoreDuplicates: true })
  },
  async getBusinessStats(profileId) {
    const sb = supabase!
    const since = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)
    const [v7, v30, stats, posts, saves] = await Promise.all([
      sb.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).gte('day', since(7)),
      sb.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).gte('day', since(30)),
      sb.from('profile_stats').select('*').eq('id', profileId).maybeSingle(),
      sb.from('feed').select('*').eq('author_id', profileId).order('created_at', { ascending: false }).limit(200),
      sb.rpc('business_save_count', { p: profileId }),
    ])
    const list = rows<FeedPost>(posts)
    return businessStats(list, { views_7d: v7.count ?? 0, views_30d: v30.count ?? 0, followers: (stats.data as ProfileStats | null)?.follower_count ?? 0, saves: (saves.data as number | null) ?? 0 })
  },
  async setPromoted(postId, promoted) {
    check(await supabase!.from('posts').update({ promoted }).eq('id', postId))
  },

  async getVenueActivity(me) {
    const sb = supabase!
    const day = new Date(Date.now() - 86_400_000).toISOString()
    const [posts, stories, follows] = await Promise.all([
      sb.from('feed').select('venue_id, kind, author_id, created_at').not('venue_id', 'is', null).gte('created_at', day).limit(500),
      sb.from('story_feed').select('venue_id').not('venue_id', 'is', null).limit(500),
      sb.from('follows').select('following_id').eq('follower_id', me),
    ])
    return activity(
      rows<{ venue_id: string; kind: string; author_id: string; created_at: string }>(posts),
      rows<{ venue_id: string }>(stories),
      new Set(rows<{ following_id: string }>(follows).map(f => f.following_id)),
      async id => (await supabase!.from('profiles').select('name').eq('id', id).maybeSingle()).data?.name ?? '',
    )
  },
}

async function rankForYou(me: string, list: FeedPost[]) {
  const [f, p, l] = await Promise.all([
    supabase!.from('follows').select('following_id').eq('follower_id', me),
    supabase!.from('profiles').select('city').eq('id', me).maybeSingle(),
    supabase!.from('feed').select('category').eq('liked_by_me', true).limit(100),
  ])
  return rankPosts(list, {
    following: new Set(rows<{ following_id: string }>(f).map(x => x.following_id)),
    city: (p.data as { city?: string } | null)?.city ?? '',
    liked: rows<{ category: Category }>(l).map(x => x.category),
  })
}

export const api: Api = isDemo ? demoApi : supabaseApi
