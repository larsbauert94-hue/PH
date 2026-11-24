import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { api } from './api'
import { useAuth, useMe } from './auth'
import type { AccountType, FeedPost, FeedQuery, NewPost, NewVenue } from './types'
import { FEED_PAGE_SIZE } from './types'

export const keys = {
  feed: (q: FeedQuery) => ['feed', q] as const,
  post: (id: string) => ['post', id] as const,
  comments: (id: string) => ['comments', id] as const,
  profile: (id: string) => ['profile', id] as const,
  stats: (id: string) => ['stats', id] as const,
  profiles: (types?: AccountType[], search?: string) => ['profiles', types, search] as const,
  venues: ['venues'] as const,
  venue: (id: string) => ['venue', id] as const,
  notifications: ['notifications'] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['messages', id] as const,
}

/** Feed mit automatischem Nachladen beim Scrollen */
export function useFeed(q: FeedQuery) {
  const { me } = useMe()
  const query = useInfiniteQuery({
    queryKey: keys.feed(q),
    queryFn: ({ pageParam }) => api.getFeed(me, q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.length < FEED_PAGE_SIZE ? undefined : last[last.length - 1].created_at),
  })
  const posts = query.data?.pages.flat() ?? []
  return { ...query, posts, loadMore: () => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage() } }
}

export const usePost = (id: string) => useQuery({ queryKey: keys.post(id), queryFn: () => api.getPost(id) })
export const useComments = (id: string) => useQuery({ queryKey: keys.comments(id), queryFn: () => api.getComments(id) })
export const useProfile = (id: string) => useQuery({ queryKey: keys.profile(id), queryFn: () => api.getProfile(id), enabled: !!id })
export const useProfileStats = (id: string) => useQuery({ queryKey: keys.stats(id), queryFn: () => api.getProfileStats(id) })
export const useProfiles = (types?: AccountType[], search?: string) =>
  useQuery({ queryKey: keys.profiles(types, search), queryFn: () => api.searchProfiles({ types, search }) })
export const useVenues = () => useQuery({ queryKey: keys.venues, queryFn: api.getVenues })
export const useVenue = (id: string) => useQuery({ queryKey: keys.venue(id), queryFn: () => api.getVenue(id) })

type FeedCache = InfiniteData<FeedPost[], string | undefined>

/** Like sofort in allen geladenen Listen umschalten, danach mit dem Server abgleichen */
export function useToggleLike() {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (p: FeedPost) => api.setLike(me, p.id, !p.liked_by_me),
    onMutate: (p: FeedPost) => {
      const flip = (x: FeedPost) => x.id === p.id ? { ...x, liked_by_me: !p.liked_by_me, like_count: x.like_count + (p.liked_by_me ? -1 : 1) } : x
      qc.setQueriesData<FeedCache>({ queryKey: ['feed'] }, old => old && { ...old, pages: old.pages.map(page => page.map(flip)) })
      qc.setQueryData<FeedPost | null>(keys.post(p.id), old => old && flip(old))
    },
    onSettled: (_d, _e, p) => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: keys.post(p.id) })
    },
  })
}

export function useAddComment(postId: string) {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (body: string) => api.addComment(me, postId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.comments(postId) })
      qc.invalidateQueries({ queryKey: keys.post(postId) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useCreatePost() {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (p: NewPost) => api.createPost(me, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: keys.stats(me) })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: keys.stats(me) })
    },
  })
}

export function useFollow(id: string) {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (follow: boolean) => api.setFollow(me, id, follow),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.stats(id) })
      qc.invalidateQueries({ queryKey: keys.stats(me) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export function useBlock(id: string) {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (block: boolean) => api.setBlock(me, id, block),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useCreateVenue() {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (v: NewVenue) => api.createVenue(me, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.venues }),
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  const { me } = useMe()
  const { refreshProfile } = useAuth()
  return useMutation({
    mutationFn: (img: { uri: string; mime?: string }) => api.uploadAvatar(me, img.uri, img.mime),
    onSuccess: async () => {
      await refreshProfile()
      qc.invalidateQueries()
    },
  })
}

// ---------------------------------------------------------------------------
// Mitteilungen und Nachrichten (werden regelmäßig aktualisiert)
// ---------------------------------------------------------------------------

export function useNotifications() {
  const query = useQuery({ queryKey: keys.notifications, queryFn: api.getNotifications, refetchInterval: 30_000 })
  const unread = query.data?.filter(n => !n.read_at).length ?? 0
  return { ...query, unread }
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  })
}

export function useConversations() {
  const query = useQuery({ queryKey: keys.conversations, queryFn: api.getConversations, refetchInterval: 15_000 })
  const unread = query.data?.reduce((n, c) => n + c.unread_count, 0) ?? 0
  return { ...query, unread }
}

export function useMessages(conversationId: string) {
  return useQuery({ queryKey: keys.messages(conversationId), queryFn: () => api.getMessages(conversationId), refetchInterval: 4_000 })
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (body: string) => api.sendMessage(me, conversationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.messages(conversationId) })
      qc.invalidateQueries({ queryKey: keys.conversations })
    },
  })
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: () => api.markConversationRead(me, conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.conversations }),
  })
}

/** Unterhaltung mit einer Person öffnen (z. B. „Nachricht“ im Profil oder „Kontakt aufnehmen“ bei Jobs) */
export function useStartConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (otherId: string) => api.startConversation(otherId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.conversations }),
  })
}
