import type { Story, StoryGroup } from './types'

/** Storys nach Person gruppieren: eigene zuerst, dann ungesehene, dann gesehene (jeweils neueste zuerst) */
export function groupStories(rows: Story[], me: string): StoryGroup[] {
  const map = new Map<string, StoryGroup>()
  for (const s of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    let g = map.get(s.author_id)
    if (!g) {
      g = { author_id: s.author_id, author_name: s.author_name, author_handle: s.author_handle, author_type: s.author_type, author_avatar_url: s.author_avatar_url, stories: [], all_seen: true }
      map.set(s.author_id, g)
    }
    g.stories.push(s)
    if (!s.seen_by_me && s.author_id !== me) g.all_seen = false
  }
  const latest = (g: StoryGroup) => g.stories[g.stories.length - 1].created_at
  return [...map.values()].sort((a, b) =>
    Number(b.author_id === me) - Number(a.author_id === me) ||
    Number(a.all_seen) - Number(b.all_seen) ||
    latest(b).localeCompare(latest(a)))
}
