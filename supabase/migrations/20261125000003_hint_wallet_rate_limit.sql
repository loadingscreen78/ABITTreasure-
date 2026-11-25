-- Hint wallet (paid hints) + per-team answer rate limit.
--  * Solving one of the first 3 questions earns wallet points (questions.wallet_points, 10 each).
--  * Later questions have 3 paid hints (low / medium / high), cost from settings.hintCosts (5 / 10 / 15).
--  * Wallet is separate from the 100-mark score. Ledger is unique per (team_id, ref): never double-earned or double-spent.
--  * Rate limit: at most settings.answerRateLimit (5) wrong / near-miss tries per team per
--    settings.answerRateWindowSeconds (60). While limited, NO submission is accepted (so it can't be gamed).

alter table public.questions add column if not exists wallet_points int not null default 0;
alter table public.questions add column if not exists hints jsonb not null default '[]'::jsonb;

create table if not exists public.wallet_entries (
  id      bigserial primary key,
  team_id text not null references public.teams (id) on delete cascade,
  ref     text not null,
  points  int not null,
  reason  text,
  at      timestamptz not null default now(),
  unique (team_id, ref)
);
create index if not exists attempts_team_at on public.attempts (team_id, at);

alter table public.wallet_entries enable row level security;
revoke all on table public.wallet_entries from anon, authenticated;
grant all on table public.wallet_entries to service_role;
revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

-- ---------- team_context: + wallet balance and bought hints ----------
create or replace function public.team_context(p_team_id text)
returns jsonb language plpgsql stable as $$
declare
  t public.teams%rowtype;
  cur_q text;
begin
  select * into t from public.teams where id = p_team_id;
  if not found then return null; end if;
  select q.id into cur_q
    from public.questions q join public.checkpoints c on c.code = q.checkpoint_code
   where c.ord = t.unlocked_cp order by q.position offset t.q_index limit 1;
  return jsonb_build_object(
    'team', public._team_json(t),
    'sessionVersion', t.session_version,
    'event', (select jsonb_build_object('status', e.status, 'startedAt', e.started_at, 'endsAt', e.ends_at,
                                        'settings', e.settings, 'event', e.event, 'resultsRevealed', e.results_revealed)
                from public.event_state e where e.id = 1),
    'checkpoints', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'order', c.ord, 'token', c.token,
                                   'location', c.location, 'arrivalCredit', c.arrival_credit,
                                   'arrivalNote', c.arrival_note, 'reveal', c.reveal) order by c.ord), '[]'::jsonb)
                      from public.checkpoints c),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'checkpointCode', q.checkpoint_code,
                                  'position', q.position, 'clue', q.clue, 'title', q.title, 'prompt', q.prompt,
                                  'code', q.code, 'match', q.match, 'accept', q.accept, 'nearMiss', q.near_miss,
                                  'isFinal', q.is_final, 'walletPoints', q.wallet_points, 'hints', q.hints) order by q.clue), '[]'::jsonb)
                    from public.questions q),
    'currentQuestionId', cur_q,
    'wrongCount', (select count(*) from public.attempts a
                    where a.team_id = t.id and a.question_id = cur_q and not a.correct and not a.near_miss),
    'solved', (select coalesce(jsonb_agg(distinct a.question_id), '[]'::jsonb) from public.attempts a
                where a.team_id = t.id and a.correct),
    'scores', (select coalesce(jsonb_object_agg(s.ref, s.marks), '{}'::jsonb) from public.score_entries s
                where s.team_id = t.id),
    'hints', (select coalesce(jsonb_agg(h.clue), '[]'::jsonb) from public.hint_uses h where h.team_id = t.id),
    'wallet', (select coalesce(sum(w.points), 0) from public.wallet_entries w where w.team_id = t.id),
    'purchases', (select coalesce(jsonb_agg(w.ref), '[]'::jsonb) from public.wallet_entries w
                   where w.team_id = t.id and w.ref like 'hint:%'),
    'now', now()
  );
end $$;

-- ---------- record_attempt: + rate limit + wallet earning ----------
create or replace function public.record_attempt(
  p_team_id text, p_question_id text, p_expected_version int,
  p_correct boolean, p_near_miss boolean, p_raw text, p_normalized text,
  p_device_id text default null, p_idem_key text default null
) returns jsonb language plpgsql as $$
declare
  t public.teams%rowtype;
  cp public.checkpoints%rowtype;
  q public.questions%rowtype;
  st jsonb;
  prev jsonb;
  cur_q text;
  n_q int;
  wrong_before int;
  attempt_no int;
  full_within int;
  marks_per int;
  cooldown_s int;
  rl_limit int;
  rl_window int;
  recent int;
  oldest timestamptz;
  marks int;
  res jsonb;
  open_state text;
  new_cooldown timestamptz;
begin
  select * into t from public.teams where id = p_team_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NO_TEAM'); end if;

  -- Idempotent replay: the same submit retried after a network drop never counts twice.
  if p_idem_key is not null then
    select a.result into prev from public.attempts a where a.team_id = t.id and a.idem_key = p_idem_key;
    if found and prev is not null then
      return prev || jsonb_build_object('replay', true, 'team', public._team_json(t));
    end if;
  end if;

  if t.version <> p_expected_version then
    return jsonb_build_object('ok', false, 'reason', 'CONFLICT', 'version', t.version);
  end if;
  if t.status <> 'ACTIVE' then return jsonb_build_object('ok', false, 'reason', 'NOT_ACTIVE'); end if;
  open_state := public._event_open(t.is_rehearsal);
  if open_state <> 'OPEN' then return jsonb_build_object('ok', false, 'reason', open_state); end if;
  if not t.arrived then return jsonb_build_object('ok', false, 'reason', 'NOT_ARRIVED'); end if;

  select * into cp from public.checkpoints where ord = t.unlocked_cp;
  select qq.id into cur_q from public.questions qq where qq.checkpoint_code = cp.code
   order by qq.position offset t.q_index limit 1;
  if cur_q is distinct from p_question_id then
    return jsonb_build_object('ok', false, 'reason', 'WRONG_QUESTION', 'currentQuestionId', cur_q);
  end if;
  if t.cooldown_until is not null and t.cooldown_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'COOLDOWN', 'cooldownUntil', t.cooldown_until);
  end if;

  select settings into st from public.event_state where id = 1;
  full_within := coalesce((st ->> 'fullMarksWithinAttempts')::int, 3);
  marks_per   := coalesce((st ->> 'marksPerClue')::int, 5);
  cooldown_s  := coalesce((st ->> 'cooldownSecondsAfterLimit')::int, 15);
  rl_limit    := coalesce((st ->> 'answerRateLimit')::int, 5);
  rl_window   := coalesce((st ->> 'answerRateWindowSeconds')::int, 60);

  -- Rate limit: count this team's wrong + near-miss tries in the window (all phones, all questions).
  if rl_limit > 0 then
    select count(*), min(x.at) into recent, oldest from (
      select a.at from public.attempts a
       where a.team_id = t.id and not a.correct and a.at > now() - make_interval(secs => rl_window)
       order by a.at desc limit rl_limit) x;
    if recent >= rl_limit then
      return jsonb_build_object('ok', false, 'reason', 'RATE_LIMIT',
                                'retryAt', oldest + make_interval(secs => rl_window), 'limit', rl_limit, 'window', rl_window);
    end if;
  end if;

  select * into q from public.questions where id = p_question_id;

  if p_near_miss then
    res := jsonb_build_object('ok', true, 'outcome', 'NEAR_MISS');
    insert into public.attempts (team_id, question_id, raw, normalized, correct, near_miss, attempt_no, device_id, idem_key, result)
    values (t.id, q.id, left(p_raw, 200), left(p_normalized, 200), false, true, null, p_device_id, p_idem_key, res);
    update public.teams set last_activity_at = now() where id = t.id returning * into t;
    return res || jsonb_build_object('team', public._team_json(t));
  end if;

  select count(*) into wrong_before from public.attempts a
   where a.team_id = t.id and a.question_id = q.id and not a.correct and not a.near_miss;
  attempt_no := wrong_before + 1;

  if p_correct then
    marks := case when attempt_no <= full_within then marks_per else 0 end;
    insert into public.score_entries (team_id, ref, marks, source, reason)
    values (t.id, 'clue:' || lpad(q.clue::text, 2, '0'), marks, 'question', q.id)
    on conflict (team_id, ref) do nothing;
    if q.wallet_points > 0 then
      insert into public.wallet_entries (team_id, ref, points, reason)
      values (t.id, 'earn:' || q.id, q.wallet_points, 'solved ' || q.id)
      on conflict (team_id, ref) do nothing;
    end if;

    if q.is_final then
      insert into public.score_entries (team_id, ref, marks, source, reason)
      values (t.id, 'final', coalesce((st ->> 'finalStageMarks')::int, 15), 'final', q.id)
      on conflict (team_id, ref) do nothing;
      update public.teams
         set status = 'FINISHED', finished_at = now(), cooldown_until = null,
             judge_code = lpad(floor(random() * 10000)::int::text, 4, '0'),
             version = version + 1, last_activity_at = now()
       where id = t.id returning * into t;
    else
      select count(*) into n_q from public.questions where checkpoint_code = cp.code;
      if t.q_index + 1 < n_q then
        update public.teams set q_index = q_index + 1, cooldown_until = null, version = version + 1,
               last_activity_at = now() where id = t.id returning * into t;
      else
        update public.teams set unlocked_cp = unlocked_cp + 1, arrived = false, q_index = 0, cooldown_until = null,
               version = version + 1, last_activity_at = now() where id = t.id returning * into t;
      end if;
    end if;
    res := jsonb_build_object('ok', true, 'outcome', 'CORRECT', 'marks', marks, 'attemptNo', attempt_no,
                              'clue', q.clue, 'questionId', q.id, 'final', q.is_final, 'walletEarned', q.wallet_points);
  else
    new_cooldown := case when attempt_no > full_within then now() + make_interval(secs => cooldown_s) else null end;
    update public.teams set cooldown_until = new_cooldown, version = version + 1, last_activity_at = now()
     where id = t.id returning * into t;
    res := jsonb_build_object('ok', true, 'outcome', 'WRONG', 'attemptNo', attempt_no,
                              'attemptsLeft', greatest(full_within - attempt_no, 0),
                              'scoring', attempt_no < full_within, 'cooldownUntil', new_cooldown,
                              'questionId', q.id);
  end if;

  insert into public.attempts (team_id, question_id, raw, normalized, correct, near_miss, attempt_no, device_id, idem_key, result)
  values (t.id, q.id, left(p_raw, 200), left(p_normalized, 200), p_correct, false, attempt_no, p_device_id, p_idem_key, res);
  return res || jsonb_build_object('team', public._team_json(t));
end $$;

-- ---------- buy_hint: atomic purchase from the wallet (row lock → two phones can't overspend) ----------
create or replace function public.buy_hint(p_team_id text, p_question_id text, p_level text)
returns jsonb language plpgsql as $$
declare
  t public.teams%rowtype;
  cp public.checkpoints%rowtype;
  q public.questions%rowtype;
  st jsonb;
  h jsonb;
  cur_q text;
  cost int;
  bal int;
  v_ref text;
  open_state text;
begin
  if p_level not in ('low', 'medium', 'high') then return jsonb_build_object('ok', false, 'reason', 'NO_HINT'); end if;
  select * into t from public.teams where id = p_team_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NO_TEAM'); end if;
  if t.status <> 'ACTIVE' then return jsonb_build_object('ok', false, 'reason', 'NOT_ACTIVE'); end if;
  open_state := public._event_open(t.is_rehearsal);
  if open_state <> 'OPEN' then return jsonb_build_object('ok', false, 'reason', open_state); end if;
  if not t.arrived then return jsonb_build_object('ok', false, 'reason', 'NOT_CURRENT'); end if;
  select * into cp from public.checkpoints where ord = t.unlocked_cp;
  select qq.id into cur_q from public.questions qq where qq.checkpoint_code = cp.code
   order by qq.position offset t.q_index limit 1;
  if cur_q is distinct from p_question_id then return jsonb_build_object('ok', false, 'reason', 'NOT_CURRENT'); end if;

  select * into q from public.questions where id = p_question_id;
  select x into h from jsonb_array_elements(q.hints) x where x ->> 'level' = p_level limit 1;
  if h is null then return jsonb_build_object('ok', false, 'reason', 'NO_HINT'); end if;

  v_ref := 'hint:' || q.id || ':' || p_level;
  select coalesce(sum(points), 0) into bal from public.wallet_entries where team_id = t.id;
  if exists (select 1 from public.wallet_entries where team_id = t.id and wallet_entries.ref = v_ref) then
    return jsonb_build_object('ok', true, 'already', true, 'text', h ->> 'text', 'balance', bal, 'level', p_level);
  end if;

  select settings into st from public.event_state where id = 1;
  cost := coalesce((st -> 'hintCosts' ->> p_level)::int,
                   case p_level when 'low' then 5 when 'medium' then 10 else 15 end);
  if bal < cost then
    return jsonb_build_object('ok', false, 'reason', 'INSUFFICIENT', 'balance', bal, 'cost', cost);
  end if;
  insert into public.wallet_entries (team_id, ref, points, reason)
  values (t.id, v_ref, -cost, p_level || ' hint for ' || q.id);
  update public.teams set last_activity_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'already', false, 'text', h ->> 'text', 'balance', bal - cost, 'cost', cost, 'level', p_level);
end $$;

-- ---------- reset_team: also clear the wallet ----------
create or replace function public.reset_team(p_team_id text)
returns void language plpgsql as $$
begin
  delete from public.arrivals where team_id = p_team_id;
  delete from public.attempts where team_id = p_team_id;
  delete from public.score_entries where team_id = p_team_id;
  delete from public.hint_uses where team_id = p_team_id;
  delete from public.wallet_entries where team_id = p_team_id;
  delete from public.scan_logs where team_id = p_team_id;
  update public.teams set status = 'ACTIVE', unlocked_cp = 1, arrived = false, q_index = 0, cooldown_until = null,
         started_at = null, finished_at = null, final_confirmed = false, final_revoked = false, teamwork = null,
         judge_code = null, version = version + 1, last_activity_at = null
   where id = p_team_id;
end $$;

-- ---------- admin_snapshot: + wallet and hints bought ----------
create or replace function public.admin_snapshot()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'now', now(),
    'event', (select to_jsonb(e) from public.event_state e where e.id = 1),
    'checkpoints', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'order', c.ord, 'token', c.token,
                      'location', c.location, 'venueDetail', c.venue_detail) order by c.ord), '[]'::jsonb)
                    from public.checkpoints c),
    'teams', (select coalesce(jsonb_agg(x order by x ->> 'id'), '[]'::jsonb) from (
      select public._team_json(t) || jsonb_build_object(
        'clueMarks', (select coalesce(sum(s.marks), 0) from public.score_entries s where s.team_id = t.id and s.ref like 'clue:%'),
        'finalMarks', (select coalesce(sum(s.marks), 0) from public.score_entries s where s.team_id = t.id and s.ref = 'final'),
        'adjustMarks', (select coalesce(sum(s.marks), 0) from public.score_entries s where s.team_id = t.id and (s.ref like 'adj:%' or s.ref like 'hint:%')),
        'scores', (select coalesce(jsonb_object_agg(s.ref, s.marks), '{}'::jsonb) from public.score_entries s where s.team_id = t.id),
        'wrongCurrent', (select count(*) from public.attempts a where a.team_id = t.id and not a.correct and not a.near_miss
                           and a.question_id = (select q.id from public.questions q join public.checkpoints c on c.code = q.checkpoint_code
                                                 where c.ord = t.unlocked_cp order by q.position offset t.q_index limit 1)),
        'wrongTotal', (select count(*) from public.attempts a where a.team_id = t.id and not a.correct and not a.near_miss),
        'hintsUsed', (select count(*) from public.hint_uses h where h.team_id = t.id),
        'wallet', (select coalesce(sum(w.points), 0) from public.wallet_entries w where w.team_id = t.id),
        'hintsBought', (select count(*) from public.wallet_entries w where w.team_id = t.id and w.ref like 'hint:%'),
        'outOfOrder', (select count(*) from public.scan_logs l where l.team_id = t.id and l.result = 'WRONG_TURN'),
        'devices', (select count(distinct d) from (
                      select device_id d from public.scan_logs where team_id = t.id and device_id is not null
                      union select device_id from public.attempts where team_id = t.id and device_id is not null) dd),
        'arrivals', (select coalesce(jsonb_object_agg(a.cp_code, a.at), '{}'::jsonb) from public.arrivals a where a.team_id = t.id)
      ) as x
      from public.teams t) teams_x)
  );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.team_context(text)',
    'public.record_attempt(text, text, int, boolean, boolean, text, text, text, text)',
    'public.buy_hint(text, text, text)', 'public.reset_team(text)', 'public.admin_snapshot()']
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
