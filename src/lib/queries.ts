import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useMe } from './auth'
import type { AccountType, FeedPost, FeedQuery, NewPost, NewVenue } from './types'

export const keys = {
  feed: (q: FeedQuery) => ['feed', q] as const,
  post: (id: string) => ['post', id] as const,
  comments: (id: string) => ['comments', id] as const,
  profile: (id: string) => ['profile', id] as const,
  stats: (id: string) => ['stats', id] as const,
  profiles: (types?: AccountType[], search?: string) => ['profiles', types, search] as const,
  venues: ['venues'] as const,
  venue: (id: string) => ['venue', id] as const,
}

export function useFeed(q: FeedQuery) {
  const { me } = useMe()
  return useQuery({ queryKey: keys.feed(q), queryFn: () => api.getFeed(me, q) })
}
export const usePost = (id: string) => useQuery({ queryKey: keys.post(id), queryFn: () => api.getPost(id) })
export const useComments = (id: string) => useQuery({ queryKey: keys.comments(id), queryFn: () => api.getComments(id) })
export const useProfile = (id: string) => useQuery({ queryKey: keys.profile(id), queryFn: () => api.getProfile(id) })
export const useProfileStats = (id: string) => useQuery({ queryKey: keys.stats(id), queryFn: () => api.getProfileStats(id) })
export const useProfiles = (types?: AccountType[], search?: string) =>
  useQuery({ queryKey: keys.profiles(types, search), queryFn: () => api.searchProfiles({ types, search }) })
export const useVenues = () => useQuery({ queryKey: keys.venues, queryFn: api.getVenues })
export const useVenue = (id: string) => useQuery({ queryKey: keys.venue(id), queryFn: () => api.getVenue(id) })

/** Like sofort in allen geladenen Listen umschalten, danach mit dem Server abgleichen */
export function useToggleLike() {
  const qc = useQueryClient()
  const { me } = useMe()
  return useMutation({
    mutationFn: (p: FeedPost) => api.setLike(me, p.id, !p.liked_by_me),
    onMutate: (p: FeedPost) => {
      const flip = (x: FeedPost) => x.id === p.id ? { ...x, liked_by_me: !p.liked_by_me, like_count: x.like_count + (p.liked_by_me ? -1 : 1) } : x
      qc.setQueriesData<FeedPost[]>({ queryKey: ['feed'] }, old => old?.map(flip))
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
