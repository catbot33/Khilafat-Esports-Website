-- Khilafat Esports shared Supabase schema
-- Run this once in the Supabase SQL Editor.

create schema if not exists private;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  game text not null check (game in ('Valorant', 'CS2', 'Chess', 'Roblox')),
  start_at timestamptz not null,
  format text not null,
  tournament_variant text not null default 'Standard',
  team_size integer not null default 5 check (team_size in (1, 2, 5)),
  map_name text not null default '',
  status text not null check (status in ('Registration open', 'Coming soon', 'Registration closed')),
  prize text not null default 'Prize pool TBA',
  region_server text not null default '',
  image_url text not null,
  visibility text not null default 'Draft' check (visibility in ('Published', 'Draft')),
  featured boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null,
  discord_name text not null,
  riot_id text not null,
  current_rank text not null,
  entry_type text not null check (entry_type in ('Solo', 'Stack')),
  needs_teammate boolean not null default false,
  teammates jsonb not null default '[]'::jsonb check (jsonb_typeof(teammates) = 'array'),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Rejected')),
  created_at timestamptz not null default now()
);

create index tournaments_visibility_start_at_idx
  on public.tournaments (visibility, start_at);

create index tournaments_featured_idx
  on public.tournaments (featured)
  where featured = true;

create unique index tournament_registrations_tournament_riot_id_idx
  on public.tournament_registrations (tournament_id, lower(riot_id));

create unique index tournament_registrations_tournament_user_idx
  on public.tournament_registrations (tournament_id, user_id);

create index tournament_registrations_tournament_idx
  on public.tournament_registrations (tournament_id, created_at desc);

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.touch_tournament_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tournaments_set_updated_at
before update on public.tournaments
for each row execute function private.touch_tournament_updated_at();

alter table public.admin_users enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

revoke all on table public.tournaments from anon, authenticated;
grant select on table public.tournaments to anon;
grant select, insert, update, delete on table public.tournaments to authenticated;

revoke all on table public.tournament_registrations from anon, authenticated;
grant select, insert, update, delete on table public.tournament_registrations to authenticated;

create policy "admins can read their membership"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "public can read published tournaments"
on public.tournaments
for select
to anon, authenticated
using (visibility = 'Published');

create policy "admins can read every tournament"
on public.tournaments
for select
to authenticated
using ((select private.is_admin()));

create policy "admins can create tournaments"
on public.tournaments
for insert
to authenticated
with check ((select private.is_admin()));

create policy "admins can update tournaments"
on public.tournaments
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "admins can delete tournaments"
on public.tournaments
for delete
to authenticated
using ((select private.is_admin()));

create policy "authenticated players can submit valorant rosters"
on public.tournament_registrations
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'Pending'
  and team_name <> ''
  and discord_name <> ''
  and riot_id <> ''
  and current_rank <> ''
  and entry_type in ('Solo', 'Stack')
  and jsonb_typeof(teammates) = 'array'
  and exists (
    select 1
    from public.tournaments
    where tournaments.id = tournament_registrations.tournament_id
      and tournaments.visibility = 'Published'
      and tournaments.game = 'Valorant'
      and tournaments.status = 'Registration open'
  )
);

create policy "players can read their tournament entries"
on public.tournament_registrations
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "admins can read tournament registrations"
on public.tournament_registrations
for select
to authenticated
using ((select private.is_admin()));

create policy "admins can update tournament registrations"
on public.tournament_registrations
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "admins can delete tournament registrations"
on public.tournament_registrations
for delete
to authenticated
using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-images',
  'tournament-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admins can inspect tournament images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tournament-images'
  and (select private.is_admin())
);

create policy "admins can upload tournament images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tournament-images'
  and (select private.is_admin())
);

create policy "admins can update tournament images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tournament-images'
  and (select private.is_admin())
)
with check (
  bucket_id = 'tournament-images'
  and (select private.is_admin())
);

create policy "admins can delete tournament images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tournament-images'
  and (select private.is_admin())
);

-- After creating your admin account in Authentication > Users, run:
-- insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE');

create table public.tournament_live_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  format text not null check (format in ('Single Elimination', 'Double Elimination', 'Swiss', 'Round Robin')),
  status text not null default 'Setup' check (status in ('Setup', 'Live', 'Completed')),
  participants jsonb not null default '[]'::jsonb check (jsonb_typeof(participants) = 'array'),
  matches jsonb not null default '[]'::jsonb check (jsonb_typeof(matches) = 'array'),
  current_round integer not null default 1 check (current_round > 0),
  total_rounds integer,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  active_match_id text,
  youtube_url text not null default '',
  discord_url text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tournament_live_events_one_live_idx
  on public.tournament_live_events ((status))
  where status = 'Live';

create index tournament_live_events_tournament_idx
  on public.tournament_live_events (tournament_id, updated_at desc);

create or replace function private.touch_live_event_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tournament_live_events_set_updated_at
before update on public.tournament_live_events
for each row execute function private.touch_live_event_updated_at();

alter table public.tournament_live_events enable row level security;
revoke all on table public.tournament_live_events from anon, authenticated;
grant select on table public.tournament_live_events to anon;
grant select, insert, update, delete on table public.tournament_live_events to authenticated;

create policy "public can read the live tournament"
on public.tournament_live_events
for select
to anon
using (
  status = 'Live'
  and exists (
    select 1
    from public.tournaments
    where tournaments.id = tournament_live_events.tournament_id
      and tournaments.visibility = 'Published'
  )
);

create policy "admins can read live tournament state"
on public.tournament_live_events for select to authenticated
using ((select private.is_admin()));

create policy "admins can create live tournament state"
on public.tournament_live_events for insert to authenticated
with check ((select private.is_admin()));

create policy "admins can update live tournament state"
on public.tournament_live_events for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "admins can delete live tournament state"
on public.tournament_live_events for delete to authenticated
using ((select private.is_admin()));
