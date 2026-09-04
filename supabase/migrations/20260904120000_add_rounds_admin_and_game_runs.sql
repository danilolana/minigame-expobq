create table if not exists public.leaderboard_rounds (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by text,
  constraint leaderboard_round_period check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists leaderboard_rounds_one_active_idx
  on public.leaderboard_rounds ((active)) where active;

alter table public.leaderboard_scores add column if not exists round_id uuid;

do $$
declare
  initial_round_id uuid;
begin
  select id into initial_round_id
  from public.leaderboard_rounds
  where active
  order by number desc
  limit 1;

  if initial_round_id is null then
    insert into public.leaderboard_rounds (number, active)
    values (coalesce((select max(number) + 1 from public.leaderboard_rounds), 1), true)
    returning id into initial_round_id;
  end if;

  update public.leaderboard_scores set round_id = initial_round_id where round_id is null;
end $$;

alter table public.leaderboard_scores alter column round_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leaderboard_scores_round_id_fkey') then
    alter table public.leaderboard_scores
      add constraint leaderboard_scores_round_id_fkey
      foreign key (round_id) references public.leaderboard_rounds(id) on delete restrict;
  end if;
end $$;

create index if not exists leaderboard_scores_round_rank_idx
  on public.leaderboard_scores (round_id, score desc, created_at asc);

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique,
  round_id uuid not null references public.leaderboard_rounds(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started',
  score integer,
  player_name varchar(18),
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint game_runs_status check (status in ('started', 'accepted', 'rejected', 'expired')),
  constraint game_runs_score check (score is null or score between 0 and 100000)
);

create index if not exists game_runs_round_started_idx on public.game_runs (round_id, started_at desc);

create or replace function public.start_game_run(p_run_id uuid)
returns table (run_id uuid, round_id uuid, started_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare current_round public.leaderboard_rounds%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('leaderboard-active-round'));
  select * into current_round from public.leaderboard_rounds where active limit 1;
  if current_round.id is null then
    raise exception using errcode = 'P0001', message = 'no_active_round';
  end if;
  return query insert into public.game_runs (run_id, round_id)
    values (p_run_id, current_round.id)
    returning game_runs.run_id, game_runs.round_id, game_runs.started_at;
end;
$$;

create or replace function public.submit_game_score(
  p_run_id uuid, p_round_id uuid, p_player_name text, p_score integer
)
returns table (id bigint, player_name varchar, score integer, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare run_row public.game_runs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('leaderboard-active-round'));
  if not exists (select 1 from public.leaderboard_rounds where leaderboard_rounds.id = p_round_id and active) then
    raise exception using errcode = 'P0001', message = 'round_closed';
  end if;
  select * into run_row from public.game_runs where game_runs.run_id = p_run_id for update;
  if run_row.id is null or run_row.round_id <> p_round_id then
    raise exception using errcode = 'P0001', message = 'invalid_run';
  end if;
  if run_row.status <> 'started' then
    raise exception using errcode = 'P0001', message = 'reused_run';
  end if;
  return query insert into public.leaderboard_scores (run_id, round_id, player_name, score)
    values (p_run_id, p_round_id, p_player_name, p_score)
    returning leaderboard_scores.id, leaderboard_scores.player_name,
      leaderboard_scores.score, leaderboard_scores.created_at;
  update public.game_runs set status = 'accepted', finished_at = now(), score = p_score,
    player_name = p_player_name, rejection_reason = null where game_runs.run_id = p_run_id;
end;
$$;

create or replace function public.reset_leaderboard_round(p_created_by text default null)
returns table (id uuid, number integer, started_at timestamptz, active boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_round public.leaderboard_rounds%rowtype;
  next_number integer;
begin
  perform pg_advisory_xact_lock(hashtext('leaderboard-active-round'));
  select * into current_round from public.leaderboard_rounds
    where leaderboard_rounds.active for update;
  if current_round.id is null then
    raise exception using errcode = 'P0001', message = 'no_active_round';
  end if;
  update public.leaderboard_rounds set active = false, ended_at = now()
    where leaderboard_rounds.id = current_round.id;
  select coalesce(max(leaderboard_rounds.number), 0) + 1 into next_number from public.leaderboard_rounds;
  return query insert into public.leaderboard_rounds (number, active, created_by)
    values (next_number, true, p_created_by)
    returning leaderboard_rounds.id, leaderboard_rounds.number,
      leaderboard_rounds.started_at, leaderboard_rounds.active;
end;
$$;

create or replace function public.get_round_history()
returns table (
  id uuid, number integer, started_at timestamptz, ended_at timestamptz,
  active boolean, participants bigint, scores_count bigint, high_score integer,
  average_score numeric, winner text
)
language sql security definer set search_path = public, pg_temp
as $$
  select r.id, r.number, r.started_at, r.ended_at, r.active,
    count(distinct s.player_name)::bigint, count(s.id)::bigint,
    coalesce(max(s.score), 0)::integer, coalesce(round(avg(s.score), 1), 0),
    (array_agg(s.player_name order by s.score desc, s.created_at asc)
      filter (where s.id is not null))[1]
  from public.leaderboard_rounds r
  left join public.leaderboard_scores s on s.round_id = r.id
  group by r.id
  order by r.number desc;
$$;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_round public.leaderboard_rounds%rowtype;
  result jsonb;
begin
  select * into current_round from public.leaderboard_rounds where active limit 1;
  if current_round.id is null then
    raise exception using errcode = 'P0001', message = 'no_active_round';
  end if;

  select jsonb_build_object(
    'round', jsonb_build_object(
      'id', current_round.id, 'number', current_round.number,
      'startedAt', current_round.started_at, 'active', current_round.active
    ),
    'stats', jsonb_build_object(
      'started', count(*),
      'accepted', count(*) filter (where g.status = 'accepted'),
      'rejected', count(*) filter (where g.status in ('rejected', 'expired')),
      'uniquePlayers', count(distinct g.player_name) filter (where g.status = 'accepted'),
      'highScore', coalesce(max(g.score) filter (where g.status = 'accepted'), 0),
      'lowScore', coalesce(min(g.score) filter (where g.status = 'accepted'), 0),
      'averageScore', coalesce(round(avg(g.score) filter (where g.status = 'accepted'), 1), 0),
      'lastActivity', max(coalesce(g.finished_at, g.started_at))
    ),
    'top', coalesce((
      select jsonb_agg(row_to_json(top_rows)) from (
        select s.id::text, s.player_name as "playerName", s.score, s.created_at as "createdAt"
        from public.leaderboard_scores s where s.round_id = current_round.id
        order by s.score desc, s.created_at asc limit 10
      ) top_rows
    ), '[]'::jsonb),
    'latestRuns', coalesce((
      select jsonb_agg(row_to_json(latest_rows)) from (
        select g.run_id::text as "runId", g.status, g.score, g.player_name as "playerName",
          g.rejection_reason as "rejectionReason", g.started_at as "startedAt", g.finished_at as "finishedAt"
        from public.game_runs g where g.round_id = current_round.id
        order by g.started_at desc limit 10
      ) latest_rows
    ), '[]'::jsonb)
  ) into result
  from public.game_runs g
  where g.round_id = current_round.id;
  return result;
end;
$$;

alter table public.leaderboard_rounds enable row level security;
alter table public.game_runs enable row level security;
revoke all on table public.leaderboard_rounds, public.game_runs from anon, authenticated;
revoke all on function public.start_game_run(uuid) from public, anon, authenticated;
revoke all on function public.submit_game_score(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.reset_leaderboard_round(text) from public, anon, authenticated;
revoke all on function public.get_round_history() from public, anon, authenticated;
revoke all on function public.get_admin_dashboard() from public, anon, authenticated;
grant select on table public.leaderboard_rounds, public.leaderboard_scores to anon, authenticated;
grant execute on function public.start_game_run(uuid) to service_role;
grant execute on function public.submit_game_score(uuid, uuid, text, integer) to service_role;
grant execute on function public.reset_leaderboard_round(text) to service_role;
grant execute on function public.get_round_history() to service_role;
grant execute on function public.get_admin_dashboard() to service_role;

drop policy if exists "Public can read active round" on public.leaderboard_rounds;
create policy "Public can read active round" on public.leaderboard_rounds for select
  to anon, authenticated using (active);
drop policy if exists "Public can read active scores" on public.leaderboard_scores;
create policy "Public can read active scores" on public.leaderboard_scores for select
  to anon, authenticated using (exists (
    select 1 from public.leaderboard_rounds r where r.id = leaderboard_scores.round_id and r.active
  ));

do $$ begin
  alter publication supabase_realtime add table public.leaderboard_rounds;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.leaderboard_scores;
exception when duplicate_object then null; end $$;

comment on table public.leaderboard_rounds is 'Persistent leaderboard rounds; exactly one is active.';
comment on table public.game_runs is 'Server-created game attempts. Full run tokens are never stored.';
