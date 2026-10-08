alter table public.tournaments
  add column if not exists tournament_variant text not null default 'Standard',
  add column if not exists map_name text not null default '';
