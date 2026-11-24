import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Post, User, Venue } from './types'
import { CURRENT_USER_ID, seedPosts, seedUsers, seedVenues } from './data/seed'

interface State {
  users: User[]
  venues: Venue[]
  posts: Post[]
  savedVenues: string[]
}

interface Store extends State {
  me: User
  user: (id: string) => User | undefined
  venue: (id?: string) => Venue | undefined
  addPost: (p: Omit<Post, 'id' | 'userId' | 'likes' | 'comments' | 'createdAt'>) => void
  deletePost: (id: string) => void
  toggleLike: (postId: string) => void
  addComment: (postId: string, text: string) => void
  toggleFollow: (userId: string) => void
  toggleSaveVenue: (venueId: string) => void
  reset: () => void
}

const KEY = 'pour-state-v1'
const initial = (): State => ({ users: seedUsers, venues: seedVenues, posts: seedPosts, savedVenues: [] })

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch { /* Speicher nicht verfügbar – mit Beispieldaten starten */ }
  return initial()
}

const uid = () => Math.random().toString(36).slice(2, 10)
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* z. B. Speicher voll */ }
  }, [state])

  const store = useMemo<Store>(() => {
    const me = state.users.find(u => u.id === CURRENT_USER_ID)!
    const updatePost = (id: string, fn: (p: Post) => Post) =>
      setState(s => ({ ...s, posts: s.posts.map(p => (p.id === id ? fn(p) : p)) }))
    return {
      ...state,
      me,
      user: id => state.users.find(u => u.id === id),
      venue: id => state.venues.find(v => v.id === id),
      addPost: p => setState(s => ({
        ...s,
        posts: [{ ...p, id: uid(), userId: CURRENT_USER_ID, likes: [], comments: [], createdAt: Date.now() }, ...s.posts],
      })),
      deletePost: id => setState(s => ({ ...s, posts: s.posts.filter(p => p.id !== id) })),
      toggleLike: id => updatePost(id, p => ({
        ...p,
        likes: p.likes.includes(CURRENT_USER_ID) ? p.likes.filter(l => l !== CURRENT_USER_ID) : [...p.likes, CURRENT_USER_ID],
      })),
      addComment: (id, text) => updatePost(id, p => ({
        ...p,
        comments: [...p.comments, { id: uid(), userId: CURRENT_USER_ID, text, createdAt: Date.now() }],
      })),
      toggleFollow: userId => setState(s => ({
        ...s,
        users: s.users.map(u => u.id !== CURRENT_USER_ID ? u : {
          ...u,
          following: u.following.includes(userId) ? u.following.filter(f => f !== userId) : [...u.following, userId],
        }),
      })),
      toggleSaveVenue: venueId => setState(s => ({
        ...s,
        savedVenues: s.savedVenues.includes(venueId) ? s.savedVenues.filter(v => v !== venueId) : [...s.savedVenues, venueId],
      })),
      reset: () => setState(initial()),
    }
  }, [state])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore außerhalb von StoreProvider')
  return s
}
