-- Require a signed-in player and allow one entry per account per tournament.
-- Existing legacy entries remain valid; future entries must include user_id.
alter table public.tournaments
  add column if not exists team_size integer not null default 5
  check (team_size in (1, 2, 5));

alter table public.tournament_registrations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists tournament_registrations_tournament_user_idx
  on public.tournament_registrations (tournament_id, user_id)
  where user_id is not null;

create index if not exists tournament_registrations_user_idx
  on public.tournament_registrations (user_id, created_at desc)
  where user_id is not null;

revoke insert on table public.tournament_registrations from anon;
grant select, insert on table public.tournament_registrations to authenticated;

drop policy if exists "public can submit valorant rosters" on public.tournament_registrations;
drop policy if exists "authenticated players can submit valorant rosters" on public.tournament_registrations;
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

drop policy if exists "players can read their tournament entries" on public.tournament_registrations;
create policy "players can read their tournament entries"
on public.tournament_registrations
for select
to authenticated
using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';

