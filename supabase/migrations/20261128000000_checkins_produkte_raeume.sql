-- Pour 2: Check-ins mit Bewertung, Produkte, Rezepte, Kollaborationen, Räume, Sammlungen,
-- Story-Umfragen, Profil-Lebenslauf, Öffnungszeiten, Statistiken und nützliche Mitteilungen.
-- Hinweis: neue Enum-Werte werden in dieser Datei nur in Funktionen (zur Laufzeit) benutzt.

alter type public.post_kind add value if not exists 'checkin';
alter type public.post_kind add value if not exists 'rezept';
alter type public.notification_type add value if not exists 'venue_post';
alter type public.notification_type add value if not exists 'job_match';

-- ---------------------------------------------------------------------------
-- Produkte (Flaschen, Weine, Spirituosen) mit Bewertungen aus Check-ins
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  brand_id uuid references public.profiles (id) on delete set null,
  brand_name text not null default '' check (char_length(brand_name) <= 80),
  category public.post_category not null default 'spirituosen',
  description text not null default '' check (char_length(description) <= 1000),
  image_url text,
  shop_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index products_name_idx on public.products (lower(name));
alter table public.products enable row level security;
create policy "Produkte lesen" on public.products for select to authenticated using (true);
create policy "Produkt anlegen" on public.products for insert to authenticated with check (created_by = auth.uid());
create policy "Eigenes Produkt ändern" on public.products for update to authenticated
  using (created_by = auth.uid() or brand_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Räume (Gruppen) für Austausch und Live-Tastings
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 500),
  city text not null default '',
  emoji text not null default '🍷',
  /** Live-Tasting: Startzeit */
  starts_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy "Räume lesen" on public.groups for select to authenticated using (true);
create policy "Raum gründen" on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy "Mitglieder lesen" on public.group_members for select to authenticated using (true);
create policy "Raum beitreten" on public.group_members for insert to authenticated with check (user_id = auth.uid());
create policy "Raum verlassen" on public.group_members for delete to authenticated using (user_id = auth.uid());

create view public.group_feed with (security_invoker = true) as
select
  g.*,
  (select count(*) from public.group_members m where m.group_id = g.id)::int as member_count,
  exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid()) as joined_by_me
from public.groups g;

-- ---------------------------------------------------------------------------
-- Neue Felder an Beiträgen
-- ---------------------------------------------------------------------------
alter table public.posts
  add column rating smallint check (rating between 1 and 5),
  add column aromas text[] not null default '{}',
  add column product_id uuid references public.products (id) on delete set null,
  -- {"ingredients":[{"name","amount"}],"steps":["…"]}
  add column recipe jsonb,
  add column remix_of uuid references public.posts (id) on delete set null,
  add column collab_id uuid references public.profiles (id) on delete set null,
  add column group_id uuid references public.groups (id) on delete cascade,
  add column promoted boolean not null default false,
  add column urgent boolean not null default false,
  add column template text check (template in ('karte', 'plakat', 'neuheit')),
  add column event_at timestamptz;
create index posts_product_idx on public.posts (product_id) where product_id is not null;
create index posts_group_idx on public.posts (group_id, created_at desc) where group_id is not null;

-- Raum-Beiträge nur für Mitglieder schreiben
create or replace function public.check_group_post() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null and not exists (select 1 from group_members where group_id = new.group_id and user_id = new.author_id) then
    raise exception 'Tritt dem Raum zuerst bei.';
  end if;
  return new;
end $$;
create trigger posts_check_group before insert on public.posts for each row execute function public.check_group_post();

-- Eigene Beiträge hervorheben (Pro-Funktion für Betriebe)
create policy "Eigenen Beitrag ändern" on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

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
  pr.name as product_name,
  c.name as collab_name,
  c.handle as collab_handle,
  g.name as group_name,
  (select count(*) from public.likes l where l.post_id = p.id)::int as like_count,
  (select count(*) from public.comments cm where cm.post_id = p.id)::int as comment_count,
  (select count(*) from public.posts r where r.remix_of = p.id)::int as remix_count,
  exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me,
  exists (select 1 from public.saves s where s.post_id = p.id and s.user_id = auth.uid()) as saved_by_me
from public.posts p
join public.profiles a on a.id = p.author_id
left join public.venues v on v.id = p.venue_id
left join public.products pr on pr.id = p.product_id
left join public.profiles c on c.id = p.collab_id
left join public.groups g on g.id = p.group_id;

create view public.product_feed with (security_invoker = true) as
select
  pr.*,
  (select count(*) from public.posts p where p.product_id = pr.id and p.rating is not null)::int as checkin_count,
  (select round(avg(p.rating)::numeric, 1) from public.posts p where p.product_id = pr.id and p.rating is not null)::float as avg_rating
from public.products pr;

-- ---------------------------------------------------------------------------
-- Profil: Lebenslauf für Gastro-Profis
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column certificates text[] not null default '{}',
  add column skills text[] not null default '{}',
  add column stations text[] not null default '{}',
  add column open_to_work boolean not null default false,
  add column available_from date;

-- ---------------------------------------------------------------------------
-- Orte: Öffnungszeiten, Happy Hour, Reservierung
-- ---------------------------------------------------------------------------
alter table public.venues
  add column opens text check (opens ~ '^[0-2][0-9]:[0-5][0-9]$'),
  add column closes text check (closes ~ '^[0-2][0-9]:[0-5][0-9]$'),
  add column happy_hour text not null default '',
  add column reservation_url text;

drop view public.venue_feed;
create view public.venue_feed with (security_invoker = true) as
select
  v.*,
  (select count(*) from public.posts p where p.venue_id = v.id)::int as post_count,
  exists (select 1 from public.venue_saves s where s.venue_id = v.id and s.user_id = auth.uid()) as saved_by_me
from public.venues v;

-- ---------------------------------------------------------------------------
-- Gemeinsame Sammlungen (z. B. „Bars für Wien“)
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create table public.collection_members (
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (collection_id, user_id)
);
create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (venue_id is null))
);
create unique index collection_items_unique on public.collection_items (collection_id, coalesce(post_id, venue_id));

create or replace function public.in_collection(c uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from collections where id = c and owner_id = auth.uid())
      or exists (select 1 from collection_members where collection_id = c and user_id = auth.uid())
$$;

alter table public.collections enable row level security;
alter table public.collection_members enable row level security;
alter table public.collection_items enable row level security;
create policy "Sammlungen lesen" on public.collections for select to authenticated using (public.in_collection(id));
create policy "Sammlung anlegen" on public.collections for insert to authenticated with check (owner_id = auth.uid());
create policy "Eigene Sammlung ändern" on public.collections for update to authenticated using (owner_id = auth.uid());
create policy "Eigene Sammlung löschen" on public.collections for delete to authenticated using (owner_id = auth.uid());
create policy "Mitglieder sehen" on public.collection_members for select to authenticated using (public.in_collection(collection_id));
create policy "Mitglied einladen" on public.collection_members for insert to authenticated
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));
create policy "Mitglied entfernen" on public.collection_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));
create policy "Einträge lesen" on public.collection_items for select to authenticated using (public.in_collection(collection_id));
create policy "Eintrag hinzufügen" on public.collection_items for insert to authenticated
  with check (added_by = auth.uid() and public.in_collection(collection_id));
create policy "Eintrag entfernen" on public.collection_items for delete to authenticated using (public.in_collection(collection_id));

create view public.collection_feed with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.collection_items i where i.collection_id = c.id)::int as item_count,
  (select coalesce(array_agg(m.user_id), '{}') from public.collection_members m where m.collection_id = c.id) as member_ids,
  (select coalesce(p.image_url, null) from public.collection_items i join public.posts p on p.id = i.post_id
    where i.collection_id = c.id order by i.created_at desc limit 1) as cover_url
from public.collections c;

-- ---------------------------------------------------------------------------
-- Story-Umfragen und -Quiz: Stimmen
-- ---------------------------------------------------------------------------
create table public.story_votes (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sticker smallint not null,
  option smallint not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id, sticker)
);
alter table public.story_votes enable row level security;
create policy "Stimmen lesen" on public.story_votes for select to authenticated using (true);
create policy "Abstimmen" on public.story_votes for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profilaufrufe für die Statistik von Betrieben
-- ---------------------------------------------------------------------------
create table public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  primary key (profile_id, viewer_id, day)
);
alter table public.profile_views enable row level security;
create policy "Aufruf zählen" on public.profile_views for insert to authenticated with check (viewer_id = auth.uid() and viewer_id <> profile_id);
create policy "Eigene Aufrufe sehen" on public.profile_views for select to authenticated using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Nützliche Mitteilungen: Neues von gemerkten Orten, passende Jobs
-- ---------------------------------------------------------------------------
create or replace function public.notify_useful() returns trigger language plpgsql security definer set search_path = public as $$
declare author_city text;
begin
  if new.venue_id is not null and new.kind::text in ('event', 'angebot', 'neuheit') then
    insert into notifications (user_id, actor_id, type, post_id)
    select s.user_id, new.author_id, 'venue_post'::notification_type, new.id
    from venue_saves s where s.venue_id = new.venue_id and s.user_id <> new.author_id;
  end if;
  if new.kind::text = 'job' then
    select city into author_city from profiles where id = new.author_id;
    insert into notifications (user_id, actor_id, type, post_id)
    select pr.id, new.author_id, 'job_match'::notification_type, new.id
    from profiles pr
    where pr.open_to_work and pr.id <> new.author_id and author_city <> '' and lower(pr.city) = lower(author_city);
  end if;
  return new;
end $$;
create trigger posts_notify_useful after insert on public.posts for each row execute function public.notify_useful();
