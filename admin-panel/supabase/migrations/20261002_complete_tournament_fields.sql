-- Safe to run more than once. Adds every field used by the Valorant admin form.
alter table public.tournaments
  add column if not exists description text not null default '',
  add column if not exists region_server text not null default '',
  add column if not exists tournament_variant text not null default 'Standard',
  add column if not exists map_name text not null default '',
  add column if not exists team_size integer not null default 5 check (team_size in (1, 2, 5));

-- Ask PostgREST to reload its schema immediately.
notify pgrst, 'reload schema';
