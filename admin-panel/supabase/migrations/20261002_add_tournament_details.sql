alter table public.tournaments
  add column if not exists description text not null default '',
  add column if not exists region_server text not null default '';
