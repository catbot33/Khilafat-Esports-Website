create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 24),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_.-]+$')
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- This table is readable only with the server-side service role. It lets the
-- login route resolve a username to the email address required by Supabase Auth.
create table if not exists public.user_login_aliases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists user_login_aliases_username_lower_idx
  on public.user_login_aliases (lower(username));

create table if not exists public.player_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  game text not null default 'Valorant',
  title text not null,
  message text not null,
  riot_id text not null,
  current_rank text not null,
  region_server text not null,
  game_mode text not null,
  timing text not null check (timing in ('now', 'later')),
  party_code text,
  discord_username text,
  play_at timestamptz,
  status text not null default 'Open' check (status in ('Open', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_invitation_timing_fields check (
    (timing = 'now' and nullif(trim(party_code), '') is not null and play_at is null)
    or
    (timing = 'later' and nullif(trim(discord_username), '') is not null and play_at is not null)
  )
);

create index if not exists player_invitations_status_created_idx
  on public.player_invitations (status, created_at desc);

create index if not exists player_invitations_owner_idx
  on public.player_invitations (owner_id, created_at desc);

create table if not exists public.invitation_join_requests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.player_invitations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  riot_id text not null,
  current_rank text not null,
  discord_username text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invitation_id, requester_id)
);

create index if not exists invitation_join_requests_invitation_idx
  on public.invitation_join_requests (invitation_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists player_invitations_set_updated_at on public.player_invitations;
create trigger player_invitations_set_updated_at
before update on public.player_invitations
for each row execute function public.set_updated_at();

drop trigger if exists invitation_join_requests_set_updated_at on public.invitation_join_requests;
create trigger invitation_join_requests_set_updated_at
before update on public.invitation_join_requests
for each row execute function public.set_updated_at();

create or replace function public.handle_new_player_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      split_part(coalesce(new.email, 'player'), '@', 1)
    ),
    '[^a-zA-Z0-9_.-]+',
    '',
    'g'
  ));

  if char_length(base_username) < 3 then
    base_username := 'player';
  end if;

  base_username := left(base_username, 18);
  final_username := base_username;

  if exists (select 1 from public.profiles where lower(username) = lower(final_username)) then
    final_username := left(base_username, 18) || '-' || substr(new.id::text, 1, 5);
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), final_username),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  insert into public.user_login_aliases (user_id, username, email)
  values (new.id, final_username, coalesce(new.email, ''))
  on conflict (user_id) do update set
    username = excluded.username,
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_player_profile on auth.users;
create trigger on_auth_user_created_player_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_player_user();

-- Backfill profiles for accounts created before this migration.
insert into public.profiles (id, username, display_name, avatar_url)
select
  users.id,
  left(lower(regexp_replace(split_part(coalesce(users.email, 'player'), '@', 1), '[^a-zA-Z0-9_.-]+', '', 'g')), 18) || '-' || substr(users.id::text, 1, 5),
  coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(users.email, 'Player'), '@', 1)),
  coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture')
from auth.users as users
where not exists (select 1 from public.profiles where profiles.id = users.id)
on conflict do nothing;

insert into public.user_login_aliases (user_id, username, email)
select users.id, profiles.username, coalesce(users.email, '')
from auth.users as users
join public.profiles on profiles.id = users.id
on conflict (user_id) do update set
  username = excluded.username,
  email = excluded.email;

alter table public.profiles enable row level security;
alter table public.user_login_aliases enable row level security;
alter table public.player_invitations enable row level security;
alter table public.invitation_join_requests enable row level security;

revoke all on table public.user_login_aliases from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update on table public.profiles to authenticated;
grant select on table public.player_invitations to anon, authenticated;
grant insert, update, delete on table public.player_invitations to authenticated;
grant select, insert, update, delete on table public.invitation_join_requests to authenticated;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "open invitations are readable" on public.player_invitations;
create policy "open invitations are readable"
on public.player_invitations for select
to anon, authenticated
using (status = 'Open' or owner_id = (select auth.uid()));

drop policy if exists "users can create their own invitations" on public.player_invitations;
create policy "users can create their own invitations"
on public.player_invitations for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "owners can update invitations" on public.player_invitations;
create policy "owners can update invitations"
on public.player_invitations for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "owners can delete invitations" on public.player_invitations;
create policy "owners can delete invitations"
on public.player_invitations for delete
to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "requesters and invitation owners can read requests" on public.invitation_join_requests;
create policy "requesters and invitation owners can read requests"
on public.invitation_join_requests for select
to authenticated
using (
  requester_id = (select auth.uid())
  or exists (
    select 1 from public.player_invitations
    where player_invitations.id = invitation_join_requests.invitation_id
      and player_invitations.owner_id = (select auth.uid())
  )
);

drop policy if exists "users can request scheduled invitations" on public.invitation_join_requests;
create policy "users can request scheduled invitations"
on public.invitation_join_requests for insert
to authenticated
with check (
  requester_id = (select auth.uid())
  and exists (
    select 1 from public.player_invitations
    where player_invitations.id = invitation_join_requests.invitation_id
      and player_invitations.owner_id <> (select auth.uid())
      and player_invitations.timing = 'later'
      and player_invitations.status = 'Open'
  )
);

drop policy if exists "invitation owners can update requests" on public.invitation_join_requests;
create policy "invitation owners can update requests"
on public.invitation_join_requests for update
to authenticated
using (
  exists (
    select 1 from public.player_invitations
    where player_invitations.id = invitation_join_requests.invitation_id
      and player_invitations.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.player_invitations
    where player_invitations.id = invitation_join_requests.invitation_id
      and player_invitations.owner_id = (select auth.uid())
  )
);

drop policy if exists "requesters and owners can delete requests" on public.invitation_join_requests;
create policy "requesters and owners can delete requests"
on public.invitation_join_requests for delete
to authenticated
using (
  requester_id = (select auth.uid())
  or exists (
    select 1 from public.player_invitations
    where player_invitations.id = invitation_join_requests.invitation_id
      and player_invitations.owner_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
