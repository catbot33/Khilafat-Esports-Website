-- This migration is self-contained: it also brings an older tournaments table
-- up to date with every field used by the Valorant details page.
alter table public.tournaments
  add column if not exists description text not null default '',
  add column if not exists region_server text not null default '',
  add column if not exists tournament_variant text not null default 'Standard',
  add column if not exists map_name text not null default '';

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
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

-- Upgrade an earlier version of the registration table without losing entries.
alter table public.tournament_registrations
  add column if not exists discord_name text not null default '',
  add column if not exists riot_id text not null default '',
  add column if not exists current_rank text not null default 'Unranked',
  add column if not exists entry_type text not null default 'Solo',
  add column if not exists needs_teammate boolean not null default false,
  add column if not exists teammates jsonb not null default '[]'::jsonb,
  add column if not exists captain_name text,
  add column if not exists captain_email text,
  add column if not exists discord_handle text,
  add column if not exists player_riot_ids text[],
  add column if not exists substitute_riot_id text;

alter table public.tournament_registrations
  alter column captain_name drop not null,
  alter column captain_email drop not null,
  alter column discord_handle drop not null,
  alter column player_riot_ids drop not null;

create unique index if not exists tournament_registrations_tournament_riot_id_idx
  on public.tournament_registrations (tournament_id, lower(riot_id));

create index if not exists tournament_registrations_tournament_idx
  on public.tournament_registrations (tournament_id, created_at desc);

alter table public.tournament_registrations enable row level security;

revoke all on table public.tournament_registrations from anon, authenticated;
grant insert on table public.tournament_registrations to anon, authenticated;
grant select, update, delete on table public.tournament_registrations to authenticated;

drop policy if exists "public can submit valorant rosters" on public.tournament_registrations;
create policy "public can submit valorant rosters"
on public.tournament_registrations
for insert
to anon, authenticated
with check (
  status = 'Pending'
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

drop policy if exists "admins can read tournament registrations" on public.tournament_registrations;
create policy "admins can read tournament registrations"
on public.tournament_registrations
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "admins can update tournament registrations" on public.tournament_registrations;
create policy "admins can update tournament registrations"
on public.tournament_registrations
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "admins can delete tournament registrations" on public.tournament_registrations;
create policy "admins can delete tournament registrations"
on public.tournament_registrations
for delete
to authenticated
using ((select private.is_admin()));

notify pgrst, 'reload schema';
