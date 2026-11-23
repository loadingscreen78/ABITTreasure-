-- ABIT Tech Treasure Hunt — schema
-- All tables have RLS ON and NO policies: the browser-visible publishable key
-- (anon / authenticated roles) can read or write nothing. Only the server's
-- secret key (service_role, which bypasses RLS) touches this data.

create table if not exists public.event_state (
  id               int primary key default 1 check (id = 1),
  status           text not null default 'DRAFT' check (status in ('DRAFT', 'LIVE', 'PAUSED', 'ENDED')),
  started_at       timestamptz,
  ends_at          timestamptz,
  settings         jsonb not null default '{}'::jsonb,
  event            jsonb not null default '{}'::jsonb,
  tie_breakers     jsonb not null default '[]'::jsonb,
  results_revealed boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table if not exists public.checkpoints (
  code           text primary key,
  ord            int not null unique,
  token          text not null unique,
  location       text not null,
  venue_detail   text,
  arrival_credit jsonb,
  arrival_note   text,
  reveal         jsonb
);

create table if not exists public.questions (
  id              text primary key,
  checkpoint_code text not null references public.checkpoints (code) on delete cascade,
  position        int not null,
  clue            int not null unique,
  title           text not null,
  prompt          text not null,
  code            text,
  match           text not null check (match in ('exact', 'acronym', 'number', 'html-tag', 'no-such-number', 'secret-word')),
  accept          jsonb not null default '[]'::jsonb,
  near_miss       jsonb not null default '{}'::jsonb,
  is_final        boolean not null default false,
  unique (checkpoint_code, position)
);

create table if not exists public.teams (
  id               text primary key,
  name             text not null,
  members          text[] not null default '{}',
  password_hash    text not null,
  password_enc     text,
  session_version  int not null default 1,
  status           text not null default 'ACTIVE' check (status in ('ACTIVE', 'FINISHED', 'DISQUALIFIED')),
  unlocked_cp      int not null default 1,
  arrived          boolean not null default false,
  q_index          int not null default 0,
  cooldown_until   timestamptz,
  started_at       timestamptz,
  finished_at      timestamptz,
  final_confirmed  boolean not null default false,
  final_revoked    boolean not null default false,
  teamwork         int check (teamwork between 0 and 5),
  judge_code       text,
  is_rehearsal     boolean not null default false,
  version          int not null default 0,
  last_activity_at timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.arrivals (
  id        bigserial primary key,
  team_id   text not null references public.teams (id) on delete cascade,
  cp_code   text not null,
  device_id text,
  at        timestamptz not null default now(),
  unique (team_id, cp_code)
);

create table if not exists public.attempts (
  id          bigserial primary key,
  team_id     text not null references public.teams (id) on delete cascade,
  question_id text not null,
  raw         text not null,
  normalized  text not null,
  correct     boolean not null,
  near_miss   boolean not null default false,
  attempt_no  int,
  device_id   text,
  idem_key    text,
  result      jsonb,
  at          timestamptz not null default now()
);
create unique index if not exists attempts_idem on public.attempts (team_id, idem_key) where idem_key is not null;
create index if not exists attempts_team_q on public.attempts (team_id, question_id);

create table if not exists public.score_entries (
  id      bigserial primary key,
  team_id text not null references public.teams (id) on delete cascade,
  ref     text not null,
  marks   int not null,
  source  text not null,
  reason  text,
  actor   text,
  at      timestamptz not null default now(),
  unique (team_id, ref)
);

create table if not exists public.scan_logs (
  id        bigserial primary key,
  team_id   text,
  cp_code   text,
  result    text not null,
  device_id text,
  at        timestamptz not null default now()
);
create index if not exists scan_logs_team on public.scan_logs (team_id);

create table if not exists public.hint_uses (
  id      bigserial primary key,
  team_id text not null references public.teams (id) on delete cascade,
  clue    int not null,
  at      timestamptz not null default now(),
  unique (team_id, clue)
);

create table if not exists public.audit_logs (
  id     bigserial primary key,
  actor  text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  at     timestamptz not null default now()
);

create table if not exists public.login_throttle (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

insert into public.event_state (id) values (1) on conflict (id) do nothing;

-- ---------- lockdown ----------
do $$
declare t text;
begin
  foreach t in array array['event_state','checkpoints','questions','teams','arrivals','attempts',
                           'score_entries','scan_logs','hint_uses','audit_logs','login_throttle']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to service_role;
