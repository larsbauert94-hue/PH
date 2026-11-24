-- Instagram-Funktionen: Bildergalerien, Reels, Gespeichertes und Storys

-- ---------------------------------------------------------------------------
-- Beiträge: mehrere Bilder (Galerie) und Video (Reel)
-- ---------------------------------------------------------------------------
alter table public.posts
  add column media text[] not null default '{}' check (cardinality(media) <= 10),
  add column video_url text;

update public.posts set media = array[image_url] where image_url is not null;

create index posts_reels_idx on public.posts (created_at desc) where video_url is not null;

-- ---------------------------------------------------------------------------
-- Gespeicherte Beiträge (nur für einen selbst sichtbar)
-- ---------------------------------------------------------------------------
create table public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.saves enable row level security;
create policy "Eigene Speicherungen lesen" on public.saves for select to authenticated using (user_id = auth.uid());
create policy "Speichern" on public.saves for insert to authenticated with check (user_id = auth.uid());
create policy "Nicht mehr speichern" on public.saves for delete to authenticated using (user_id = auth.uid());

-- Feed-View neu anlegen, damit die neuen Spalten und „gespeichert“ enthalten sind
drop view public.feed;
create view public.feed with (security_invoker = true) as
select
  p.*,
  a.handle as author_handle,
  a.name as author_name,
  a.account_type as author_type,
  a.headline as author_headline,
  a.avatar_url as author_avatar_url,
  a.verified as author_verified,
  v.name as venue_name,
  v.city as venue_city,
  (select count(*) from public.likes l where l.post_id = p.id)::int as like_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comment_count,
  exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me,
  exists (select 1 from public.saves s where s.post_id = p.id and s.user_id = auth.uid()) as saved_by_me
from public.posts p
join public.profiles a on a.id = p.author_id
left join public.venues v on v.id = p.venue_id;

-- ---------------------------------------------------------------------------
-- Storys: Bild oder Video, 24 Stunden sichtbar
-- ---------------------------------------------------------------------------
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text check (char_length(caption) <= 200),
  venue_id uuid references public.venues (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index stories_active_idx on public.stories (expires_at desc);
create index stories_author_idx on public.stories (author_id, created_at);

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

create policy "Aktive Storys lesen" on public.stories for select to authenticated
  using ((expires_at > now() or author_id = auth.uid()) and not public.is_blocked(author_id));
create policy "Story posten" on public.stories for insert to authenticated with check (author_id = auth.uid());
create policy "Eigene Story löschen" on public.stories for delete to authenticated using (author_id = auth.uid());

-- Ansehen vermerken: nur als man selbst; lesen dürfen Betrachter (eigene) und die Story-Autor:innen
create policy "Als gesehen markieren" on public.story_views for insert to authenticated with check (viewer_id = auth.uid());
create policy "Aufrufe lesen" on public.story_views for select to authenticated using (
  viewer_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
);

create view public.story_feed with (security_invoker = true) as
select
  s.*,
  a.handle as author_handle,
  a.name as author_name,
  a.account_type as author_type,
  a.avatar_url as author_avatar_url,
  a.verified as author_verified,
  v.name as venue_name,
  exists (select 1 from public.story_views sv where sv.story_id = s.id and sv.viewer_id = auth.uid()) as seen_by_me,
  (select count(*) from public.story_views sv where sv.story_id = s.id)::int as view_count
from public.stories s
join public.profiles a on a.id = s.author_id
left join public.venues v on v.id = s.venue_id
where s.expires_at > now();

-- ---------------------------------------------------------------------------
-- Speicher: Videos für Reels und Storys erlauben (bis 50 MB)
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
where id = 'media';
