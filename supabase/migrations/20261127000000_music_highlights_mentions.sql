-- Musik, Story-Sticker, Highlights, @Erwähnungen und Likes auf Kommentare

-- ---------------------------------------------------------------------------
-- Musik (Spotify-Titel als Verweis) an Beiträgen/Reels und Sticker in Storys
-- ---------------------------------------------------------------------------
-- music: {"id","title","artist","cover_url","spotify_url","preview_url"}
alter table public.posts add column music jsonb;
-- overlays: [{"type":"text"|"music"|"location"|"mention", "x":0..1, "y":0..1, ...}]
alter table public.stories
  add column music jsonb,
  add column overlays jsonb not null default '[]'::jsonb check (jsonb_typeof(overlays) = 'array');

-- Feed-View neu anlegen, damit die Spalte music enthalten ist
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
-- Highlights: dauerhaft sichtbare Story-Sammlungen im Profil
-- ---------------------------------------------------------------------------
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 30),
  cover_url text,
  created_at timestamptz not null default now()
);
create index highlights_owner_idx on public.highlights (owner_id, created_at);

create table public.highlight_stories (
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  position int not null default 0,
  primary key (highlight_id, story_id)
);

alter table public.highlights enable row level security;
alter table public.highlight_stories enable row level security;

create policy "Highlights lesen" on public.highlights for select to authenticated using (not public.is_blocked(owner_id));
create policy "Highlight anlegen" on public.highlights for insert to authenticated with check (owner_id = auth.uid());
create policy "Highlight ändern" on public.highlights for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Highlight löschen" on public.highlights for delete to authenticated using (owner_id = auth.uid());

create function public.owns_highlight(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.highlights where id = h and owner_id = auth.uid());
$$;

create policy "Highlight-Storys lesen" on public.highlight_stories for select to authenticated using (true);
create policy "Story zu Highlight hinzufügen" on public.highlight_stories for insert to authenticated with check (
  public.owns_highlight(highlight_id)
  and exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
);
create policy "Story aus Highlight entfernen" on public.highlight_stories for delete to authenticated using (public.owns_highlight(highlight_id));

-- Storys in Highlights bleiben auch nach 24 Stunden sichtbar
drop policy "Aktive Storys lesen" on public.stories;
create policy "Storys lesen" on public.stories for select to authenticated using (
  not public.is_blocked(author_id) and (
    expires_at > now()
    or author_id = auth.uid()
    or exists (select 1 from public.highlight_stories hs where hs.story_id = stories.id)
  )
);

-- Story-View neu anlegen (enthält jetzt Musik und Sticker)
drop view public.story_feed;
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

-- Alle Storys eines Highlights (ohne 24-Stunden-Grenze)
create view public.highlight_story_feed with (security_invoker = true) as
select
  hs.highlight_id,
  hs.position,
  s.*,
  a.handle as author_handle,
  a.name as author_name,
  a.account_type as author_type,
  a.avatar_url as author_avatar_url,
  a.verified as author_verified,
  v.name as venue_name,
  true as seen_by_me,
  (select count(*) from public.story_views sv where sv.story_id = s.id)::int as view_count
from public.highlight_stories hs
join public.stories s on s.id = hs.story_id
join public.profiles a on a.id = s.author_id
left join public.venues v on v.id = s.venue_id;

-- Eigenes Story-Archiv (auch abgelaufene) zum Anlegen von Highlights
create view public.my_story_archive with (security_invoker = true) as
select s.* from public.stories s where s.author_id = auth.uid();

-- ---------------------------------------------------------------------------
-- Likes auf Kommentare
-- ---------------------------------------------------------------------------
create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_likes enable row level security;
create policy "Kommentar-Likes lesen" on public.comment_likes for select to authenticated using (true);
create policy "Kommentar liken" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
create policy "Kommentar-Like entfernen" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

drop view public.comment_feed;
create view public.comment_feed with (security_invoker = true) as
select
  c.*,
  a.handle as author_handle,
  a.name as author_name,
  a.account_type as author_type,
  a.avatar_url as author_avatar_url,
  (select count(*) from public.comment_likes cl where cl.comment_id = c.id)::int as like_count,
  exists (select 1 from public.comment_likes cl where cl.comment_id = c.id and cl.user_id = auth.uid()) as liked_by_me
from public.comments c
join public.profiles a on a.id = c.author_id;

-- ---------------------------------------------------------------------------
-- @Erwähnungen: Mitteilung an alle erwähnten Profile in Beiträgen und Kommentaren
-- ---------------------------------------------------------------------------
alter type public.notification_type add value if not exists 'mention';

create function public.notify_mentions(body text, actor uuid, post uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select distinct p.id, actor, 'mention'::public.notification_type, post
  from regexp_matches(coalesce(body, ''), '@([a-z0-9._]{3,30})', 'gi') as m(handle)
  join public.profiles p on p.handle = lower(m.handle[1])
  where p.id <> actor and not exists (
    select 1 from public.blocks b where (b.blocker_id = p.id and b.blocked_id = actor) or (b.blocker_id = actor and b.blocked_id = p.id)
  );
end;
$$;

create function public.on_post_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_mentions(coalesce(new.title, '') || ' ' || new.body, new.author_id, new.id);
  return new;
end;
$$;
create trigger posts_mentions after insert on public.posts for each row execute function public.on_post_mentions();

create function public.on_comment_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_mentions(new.body, new.author_id, new.post_id);
  return new;
end;
$$;
create trigger comments_mentions after insert on public.comments for each row execute function public.on_comment_mentions();

-- ---------------------------------------------------------------------------
-- Orte merken (wie „Speichern“ bei Instagram-Orten) und Ortsstatistik
-- ---------------------------------------------------------------------------
create table public.venue_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);
alter table public.venue_saves enable row level security;
create policy "Eigene gemerkte Orte lesen" on public.venue_saves for select to authenticated using (user_id = auth.uid());
create policy "Ort merken" on public.venue_saves for insert to authenticated with check (user_id = auth.uid());
create policy "Ort nicht mehr merken" on public.venue_saves for delete to authenticated using (user_id = auth.uid());

create view public.venue_feed with (security_invoker = true) as
select
  v.*,
  (select count(*) from public.posts p where p.venue_id = v.id)::int as post_count,
  exists (select 1 from public.venue_saves s where s.venue_id = v.id and s.user_id = auth.uid()) as saved_by_me
from public.venues v;
