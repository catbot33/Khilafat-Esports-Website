-- Live tournament state shared by the control panel and public website.
create table if not exists public.tournament_live_events (
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

create unique index if not exists tournament_live_events_one_live_idx
  on public.tournament_live_events ((status))
  where status = 'Live';

create index if not exists tournament_live_events_tournament_idx
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

drop trigger if exists tournament_live_events_set_updated_at on public.tournament_live_events;
create trigger tournament_live_events_set_updated_at
before update on public.tournament_live_events
for each row execute function private.touch_live_event_updated_at();

alter table public.tournament_live_events enable row level security;

revoke all on table public.tournament_live_events from anon, authenticated;
grant select on table public.tournament_live_events to anon;
grant select, insert, update, delete on table public.tournament_live_events to authenticated;

drop policy if exists "public can read the live tournament" on public.tournament_live_events;
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

drop policy if exists "admins can read live tournament state" on public.tournament_live_events;
create policy "admins can read live tournament state"
on public.tournament_live_events
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "admins can create live tournament state" on public.tournament_live_events;
create policy "admins can create live tournament state"
on public.tournament_live_events
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "admins can update live tournament state" on public.tournament_live_events;
create policy "admins can update live tournament state"
on public.tournament_live_events
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "admins can delete live tournament state" on public.tournament_live_events;
create policy "admins can delete live tournament state"
on public.tournament_live_events
for delete
to authenticated
using ((select private.is_admin()));

notify pgrst, 'reload schema';
