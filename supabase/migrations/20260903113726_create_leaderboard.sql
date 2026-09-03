create table if not exists public.leaderboard_scores (
  id bigint generated always as identity primary key,
  run_id uuid not null unique,
  player_name varchar(18) not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_player_name_length check (char_length(btrim(player_name)) between 2 and 18),
  constraint leaderboard_score_range check (score between 0 and 100000)
);

alter table public.leaderboard_scores enable row level security;

revoke all on table public.leaderboard_scores from anon, authenticated;

create index if not exists leaderboard_scores_rank_idx
  on public.leaderboard_scores (score desc, created_at asc);

comment on table public.leaderboard_scores is
  'Global game scores. Reads and writes are mediated by the Vercel Function.';
