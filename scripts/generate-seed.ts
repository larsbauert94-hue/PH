// Erzeugt supabase/seed.sql aus den Beispieldaten in src/lib/demo-data.ts.
// Aufruf: npm run seed:generate
// @ts-expect-error Node-Typen sind im App-Projekt nicht installiert
import { writeFileSync } from 'node:fs'
import { seedComments, seedConversations, seedFollows, seedLikes, seedPosts, seedProfiles, seedVenues } from '../src/lib/demo-data.ts'

const q = (v: unknown): string =>
  v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`
const ago = (h: number) => `now() - interval '${h} hours'`

const lines: string[] = [
  '-- Automatisch erzeugt aus src/lib/demo-data.ts (npm run seed:generate). Nicht von Hand bearbeiten.',
  '-- Beispieldaten: alle Betriebe, Marken und Personen sind frei erfunden.',
  '-- Die Beispiel-Accounts haben kein nutzbares Passwort (Anmeldung nur über eigene Accounts).',
  '',
  '-- Nutzer anlegen; der Trigger on_auth_user_created erzeugt die Profile',
  'insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values',
  seedProfiles.map(p => `  ('00000000-0000-0000-0000-000000000000', ${q(p.id)}, 'authenticated', 'authenticated', ${q(p.email)}, '', now(), ${q(JSON.stringify({ handle: p.handle, name: p.name, account_type: p.account_type, headline: p.headline, workplace: p.workplace, city: p.city, terms_accepted: true }))}, '{"provider":"email","providers":["email"]}', now() - interval '90 days', now())`).join(',\n') + ';',
  '',
  '-- Profildetails ergänzen, die der Trigger nicht setzt',
  ...seedProfiles.map(p => `update public.profiles set bio = ${q(p.bio)}, website = ${q(p.website)}, verified = ${p.verified} where id = ${q(p.id)};`),
  '',
  'insert into public.venues (id, owner_id, name, type, address, city, latitude, longitude, description, website, phone) values',
  seedVenues.map(v => `  (${[v.id, v.owner_id, v.name, v.type, v.address, v.city, v.latitude, v.longitude, v.description, v.website, v.phone].map(q).join(', ')})`).join(',\n') + ';',
  '',
  'insert into public.posts (id, author_id, kind, title, body, category, link_url, venue_id, created_at) values',
  seedPosts.map(p => `  (${[p.id, p.author_id, p.kind, p.title, p.body, p.category, p.link_url, p.venue_id].map(q).join(', ')}, ${ago(p.hoursAgo)})`).join(',\n') + ';',
  '',
  'insert into public.follows (follower_id, following_id) values',
  seedFollows.map(([a, b]) => `  (${q(a)}, ${q(b)})`).join(',\n') + ';',
  '',
  'insert into public.likes (post_id, user_id) values',
  seedLikes.map(([a, b]) => `  (${q(a)}, ${q(b)})`).join(',\n') + ';',
  '',
  'insert into public.comments (id, post_id, author_id, body, created_at) values',
  seedComments.map(c => `  (${[c.id, c.post_id, c.author_id, c.body].map(q).join(', ')}, ${ago(c.hoursAgo)})`).join(',\n') + ';',
  '',
  '-- Unterhaltungen (Mitteilungen zu Likes, Kommentaren und Follows erzeugen die Trigger automatisch)',
  ...seedConversations.flatMap(c => {
    const lastH = c.messages[c.messages.length - 1][2]
    return [
      `insert into public.conversations (id) values (${q(c.id)});`,
      `insert into public.conversation_members (conversation_id, user_id, last_read_at) values ${c.members.map(m => `(${q(c.id)}, ${q(m)}, ${ago(lastH + 0.1)})`).join(', ')};`,
      'insert into public.messages (conversation_id, sender_id, body, created_at) values',
      c.messages.map(([from, body, h]) => `  (${q(c.id)}, ${q(from)}, ${q(body)}, ${ago(h)})`).join(',\n') + ';',
    ]
  }),
  '',
]

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), lines.join('\n'))
console.log('supabase/seed.sql geschrieben')
