import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./20260904120000_add_rounds_admin_and_game_runs.sql', import.meta.url), 'utf8')

describe('rounds migration contract', () => {
  it('preserva scores, cria a rodada inicial e torna round_id obrigatório', () => {
    expect(sql).toContain('update public.leaderboard_scores set round_id = initial_round_id')
    expect(sql).toContain('alter column round_id set not null')
    expect(sql).not.toMatch(/delete\s+from\s+public\.leaderboard_scores/i)
    expect(sql).not.toMatch(/truncate/i)
  })

  it('garante somente uma rodada ativa e reset transacional', () => {
    expect(sql).toContain('leaderboard_rounds_one_active_idx')
    expect(sql).toContain('where active')
    expect(sql).toContain('reset_leaderboard_round')
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('leaderboard-active-round'))")
  })

  it('registra partidas e associa o score à rodada do token', () => {
    expect(sql).toContain('create table if not exists public.game_runs')
    expect(sql).toContain('submit_game_score')
    expect(sql).toContain('run_row.round_id <> p_round_id')
    expect(sql).toContain("message = 'round_closed'")
  })

  it('restringe mutações ao service_role e habilita Realtime mínimo', () => {
    expect(sql).toContain('grant execute on function public.reset_leaderboard_round(text) to service_role')
    expect(sql).toContain('Public can read active scores')
    expect(sql).toContain('alter publication supabase_realtime add table public.leaderboard_scores')
  })
})
