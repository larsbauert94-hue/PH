-- Pour: Branchennetzwerk für Wein, Spirituosen, Bars und Restaurants
-- Schema, Zugriffsregeln (Row Level Security) und Speicher für Bilder.

-- ---------------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------------
-- Betriebe: bar, restaurant, haendler, lieferant, marke
-- Personen: gastro (arbeitet in Gastronomie/Branche), privat (Genießer:innen)
create type public.account_type as enum ('bar', 'restaurant', 'haendler', 'lieferant', 'marke', 'gastro', 'privat');
create type public.venue_type as enum ('bar', 'cocktailbar', 'weinbar', 'restaurant', 'hotelbar');
create type public.post_kind as enum ('beitrag', 'neuheit', 'angebot', 'event', 'job');
create type public.post_category as enum ('wein', 'spirituosen', 'bier', 'cocktails', 'alkoholfrei', 'gastronomie');

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9._]{3,30}$'),
  name text not null check (char_length(name) between 1 and 80),
  account_type public.account_type not null default 'privat',
  -- Berufsangaben wie bei LinkedIn, z. B. "Head Bartender" bei "Nachtschatten"
  headline text not null default '' check (char_length(headline) <= 100),
  workplace text not null default '' check (char_length(workplace) <= 100),
  bio text not null default '' check (char_length(bio) <= 500),
  city text not null default '',
  website text,
  avatar_url text,
  verified boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  type public.venue_type not null,
  address text not null,
  city text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  description text not null default '' check (char_length(description) <= 1000),
  website text,
  phone text,
  created_at timestamptz not null default now()
);
create index venues_city_idx on public.venues (city);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.post_kind not null default 'beitrag',
  title text check (char_length(title) <= 140),
  body text not null check (char_length(body) between 1 and 3000),
  image_url text,
  category public.post_category not null,
  link_url text,
  venue_id uuid references public.venues (id) on delete set null,
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_venue_idx on public.posts (venue_id);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

-- Blockieren und Melden (App-Store-Pflicht bei nutzergenerierten Inhalten)
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  check (post_id is not null or profile_id is not null)
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------
-- true, wenn einer der beiden Nutzer den anderen blockiert hat
create function public.is_blocked(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

-- Profil automatisch bei der Registrierung anlegen (Daten aus den Metadaten der Anmeldung)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text := lower(regexp_replace(coalesce(meta ->> 'handle', split_part(new.email, '@', 1), 'nutzer'), '[^a-zA-Z0-9._]', '', 'g'));
  candidate text;
begin
  base := left(case when char_length(base) < 3 then 'nutzer' else base end, 24);
  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, handle, name, account_type, headline, workplace, city, terms_accepted_at)
  values (
    new.id,
    candidate,
    coalesce(nullif(meta ->> 'name', ''), candidate),
    coalesce((meta ->> 'account_type')::public.account_type, 'privat'),
    left(coalesce(meta ->> 'headline', ''), 100),
    left(coalesce(meta ->> 'workplace', ''), 100),
    coalesce(meta ->> 'city', ''),
    case when (meta ->> 'terms_accepted')::boolean then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Account selbst löschen (App-Store-Pflicht). Alle Daten werden per Cascade entfernt.
-- Hochgeladene Bilder löscht die App vorher über die Storage-API.
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Onboarding abschließen (nach E-Mail-, Apple- oder Google-Anmeldung).
-- Setzt Profildaten und bestätigt Volljährigkeit sowie Nutzungsbedingungen.
create function public.complete_onboarding(
  p_name text, p_handle text, p_account_type public.account_type,
  p_headline text, p_workplace text, p_city text
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  result public.profiles;
  clean_handle text := lower(trim(p_handle));
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and terms_accepted_at is not null) then
    raise exception 'Onboarding wurde bereits abgeschlossen.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where handle = clean_handle and id <> auth.uid()) then
    raise exception 'Dieser Nutzername ist schon vergeben.' using errcode = 'P0001';
  end if;
  update public.profiles set
    name = trim(p_name),
    handle = clean_handle,
    account_type = p_account_type,
    headline = left(coalesce(trim(p_headline), ''), 100),
    workplace = left(coalesce(trim(p_workplace), ''), 100),
    city = coalesce(trim(p_city), ''),
    terms_accepted_at = now()
  where id = auth.uid()
  returning * into result;
  return result;
end;
$$;
revoke execute on function public.complete_onboarding from public, anon;
grant execute on function public.complete_onboarding to authenticated;

-- Felder, die Nutzer nicht selbst setzen dürfen
create function public.protect_profile_fields() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    new.verified := old.verified;
    new.terms_accepted_at := old.terms_accepted_at;
    new.account_type := old.account_type; -- Wechsel Person <-> Betrieb nur über den Support
    new.id := old.id;
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Ansichten für Feed und Kommentare (security_invoker: Zugriffsregeln der Tabellen gelten)
-- ---------------------------------------------------------------------------
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
  exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me
from public.posts p
join public.profiles a on a.id = p.author_id
left join public.venues v on v.id = p.venue_id;

create view public.comment_feed with (security_invoker = true) as
select
  c.*,
  a.handle as author_handle,
  a.name as author_name,
  a.account_type as author_type,
  a.avatar_url as author_avatar_url
from public.comments c
join public.profiles a on a.id = c.author_id;

create view public.profile_stats with (security_invoker = true) as
select
  pr.id,
  (select count(*) from public.posts p where p.author_id = pr.id)::int as post_count,
  (select count(*) from public.follows f where f.following_id = pr.id)::int as follower_count,
  (select count(*) from public.follows f where f.follower_id = pr.id)::int as following_count,
  exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = pr.id) as followed_by_me,
  exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = pr.id) as blocked_by_me
from public.profiles pr;

-- ---------------------------------------------------------------------------
-- Row Level Security: Lesen nur für angemeldete Nutzer, Schreiben nur eigene Daten
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "Profile lesen" on public.profiles for select to authenticated using (true);
create policy "Eigenes Profil ändern" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Orte lesen" on public.venues for select to authenticated using (true);
create policy "Ort eintragen" on public.venues for insert to authenticated with check (owner_id = auth.uid());
create policy "Eigenen Ort ändern" on public.venues for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Eigenen Ort löschen" on public.venues for delete to authenticated using (owner_id = auth.uid());

create policy "Beiträge lesen" on public.posts for select to authenticated
  using (not public.is_blocked(author_id));
create policy "Beitrag erstellen" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "Eigenen Beitrag löschen" on public.posts for delete to authenticated using (author_id = auth.uid());

create policy "Likes lesen" on public.likes for select to authenticated using (true);
create policy "Liken" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "Like entfernen" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "Kommentare lesen" on public.comments for select to authenticated
  using (not public.is_blocked(author_id));
create policy "Kommentieren" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "Eigenen Kommentar löschen" on public.comments for delete to authenticated using (author_id = auth.uid());

create policy "Follows lesen" on public.follows for select to authenticated using (true);
create policy "Folgen" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "Entfolgen" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "Eigene Blockierungen lesen" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "Blockieren" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "Blockierung aufheben" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Meldungen können nur erstellt werden; lesen nur Admins (Service-Role / Dashboard)
create policy "Melden" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- Wer blockiert, folgt nicht mehr
create function public.unfollow_on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;
create trigger blocks_unfollow after insert on public.blocks
  for each row execute function public.unfollow_on_block();

-- ---------------------------------------------------------------------------
-- Speicher für Bilder: öffentlich lesbar, Upload nur in den eigenen Ordner <user-id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "Bilder hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Eigene Bilder lesen" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Eigene Bilder löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
