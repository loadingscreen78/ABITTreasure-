-- Student self-registration from the home page. Organisers review, export to Excel and turn
-- registrations into teams (with IDs + passwords) from /admin/teams.
create table if not exists public.registrations (
  id          bigserial primary key,
  team_name   text not null check (char_length(team_name) between 2 and 60),
  members     text[] not null check (cardinality(members) between 3 and 4),
  status      text not null default 'PENDING' check (status in ('PENDING', 'IMPORTED', 'REJECTED')),
  team_id     text references public.teams (id) on delete set null,
  ref         text not null unique,
  created_at  timestamptz not null default now()
);
-- one live registration per team name (case-insensitive)
create unique index if not exists registrations_name_live on public.registrations (lower(team_name)) where status <> 'REJECTED';

alter table public.registrations enable row level security;
revoke all on table public.registrations from anon, authenticated;
grant all on table public.registrations to service_role;
revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to service_role;
