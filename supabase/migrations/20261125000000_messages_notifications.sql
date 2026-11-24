-- Direktnachrichten und Mitteilungen

-- ---------------------------------------------------------------------------
-- Mitteilungen (Likes, Kommentare, neue Follower) – werden per Trigger erzeugt
-- ---------------------------------------------------------------------------
create type public.notification_type as enum ('like', 'comment', 'follow');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Eigene Mitteilungen lesen" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Eigene Mitteilungen ändern" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Eigene Mitteilungen löschen" on public.notifications for delete to authenticated using (user_id = auth.uid());

create function public.notify_like() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select p.author_id, new.user_id, 'like', new.post_id
  from public.posts p where p.id = new.post_id and p.author_id <> new.user_id;
  return new;
end;
$$;
create trigger likes_notify after insert on public.likes for each row execute function public.notify_like();

create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select p.author_id, new.author_id, 'comment', new.post_id
  from public.posts p where p.id = new.post_id and p.author_id <> new.author_id;
  return new;
end;
$$;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_comment();

create function public.notify_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, type) values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_follow();

create view public.notification_feed with (security_invoker = true) as
select
  n.*,
  a.handle as actor_handle,
  a.name as actor_name,
  a.account_type as actor_type,
  a.avatar_url as actor_avatar_url,
  coalesce(p.title, left(p.body, 80)) as post_snippet
from public.notifications n
join public.profiles a on a.id = n.actor_id
left join public.posts p on p.id = n.post_id
where not public.is_blocked(n.actor_id);

create function public.mark_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Direktnachrichten: Unterhaltungen zwischen genau zwei Personen
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create function public.is_member(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid());
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Eigene Unterhaltungen lesen" on public.conversations for select to authenticated using (public.is_member(id));
create policy "Mitglieder lesen" on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
create policy "Gelesen markieren" on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Nachrichten lesen" on public.messages for select to authenticated using (public.is_member(conversation_id));
create policy "Nachricht senden" on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_member(conversation_id)
  and not exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.user_id <> auth.uid() and public.is_blocked(m.user_id)
  )
);

create function public.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message();

-- Bestehende Unterhaltung mit einer Person finden oder neu anlegen
create function public.start_conversation(other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  conv uuid;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if other = auth.uid() then raise exception 'Du kannst dir nicht selbst schreiben.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'Profil nicht gefunden.' using errcode = 'P0001'; end if;
  if public.is_blocked(other) then raise exception 'Mit diesem Profil ist kein Kontakt möglich.' using errcode = 'P0001'; end if;

  select a.conversation_id into conv
  from public.conversation_members a
  join public.conversation_members b on b.conversation_id = a.conversation_id
  where a.user_id = auth.uid() and b.user_id = other
  limit 1;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, auth.uid()), (conv, other);
  end if;
  return conv;
end;
$$;
revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Übersicht: eine Zeile pro Unterhaltung mit Gesprächspartner, letzter Nachricht und Ungelesen-Zähler
create view public.my_conversations with (security_invoker = true) as
select
  c.id,
  c.last_message_at,
  o.user_id as other_id,
  p.handle as other_handle,
  p.name as other_name,
  p.account_type as other_type,
  p.avatar_url as other_avatar_url,
  p.headline as other_headline,
  lm.body as last_body,
  lm.sender_id as last_sender_id,
  (select count(*) from public.messages x
    where x.conversation_id = c.id and x.sender_id <> auth.uid() and x.created_at > me.last_read_at)::int as unread_count,
  public.is_blocked(o.user_id) as blocked
from public.conversation_members me
join public.conversations c on c.id = me.conversation_id
join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
join public.profiles p on p.id = o.user_id
left join lateral (
  select body, sender_id from public.messages m where m.conversation_id = c.id order by created_at desc limit 1
) lm on true
where me.user_id = auth.uid();
