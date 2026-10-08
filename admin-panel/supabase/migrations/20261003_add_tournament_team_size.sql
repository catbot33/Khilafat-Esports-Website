-- Adds the team format selected in the admin publisher: 5v5, 2v2, or 1v1.
alter table public.tournaments
  add column if not exists team_size integer not null default 5
  check (team_size in (1, 2, 5));

notify pgrst, 'reload schema';
