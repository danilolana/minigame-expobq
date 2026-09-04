import { randomUUID } from 'node:crypto'
import { MAX_SCORE, normalizePlayerName, validatePlayerName, type RankingEntry } from '../src/lib/ranking.js'
import { methodNotAllowed, parseBody, setApiHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js'
import { createRunToken, maximumPlausibleScore, RunTokenError, verifyRunToken } from './_lib/run-token.js'
import { getActiveRound, getSupabaseAdmin } from './_lib/supabase.js'

type ScoreRow = { id: string | number; player_name: string; score: number; created_at: string }

function toEntry(row: ScoreRow): RankingEntry {
  return { id: String(row.id), playerName: row.player_name, score: row.score, createdAt: row.created_at }
}

async function getLeaderboard() {
  const round = await getActiveRound()
  const { data, error } = await getSupabaseAdmin().from('leaderboard_scores')
    .select('id, player_name, score, created_at').eq('round_id', round.id)
    .order('score', { ascending: false }).order('created_at', { ascending: true }).limit(10)
  if (error) throw error
  return {
    round: { id: round.id, number: round.number, startedAt: round.started_at },
    entries: (data as ScoreRow[]).map(toEntry),
  }
}

async function updateRejectedRun(runId: string, reason: string, status: 'rejected' | 'expired' = 'rejected') {
  await getSupabaseAdmin().from('game_runs').update({
    status, rejection_reason: reason, finished_at: new Date().toISOString(),
  }).eq('run_id', runId).eq('status', 'started')
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  try {
    if (request.method === 'GET') return response.status(200).json(await getLeaderboard())
    if (request.method !== 'POST') return methodNotAllowed(response, 'GET, POST')

    const body = parseBody(request)
    if (!body || typeof body.action !== 'string') return response.status(400).json({ message: 'Requisição inválida.' })

    const runSecret = process.env.RUN_TOKEN_SECRET ?? ''
    if (body.action === 'start') {
      const runId = randomUUID()
      const { data, error } = await getSupabaseAdmin().rpc('start_game_run', { p_run_id: runId }).single()
      if (error) throw error
      const run = data as { run_id: string; round_id: string }
      return response.status(201).json({ runToken: createRunToken(runSecret, run.run_id, run.round_id) })
    }

    if (body.action !== 'save' || typeof body.playerName !== 'string' || typeof body.runToken !== 'string'
      || typeof body.score !== 'number' || !Number.isInteger(body.score)) {
      return response.status(400).json({ message: 'Dados da tentativa inválidos.' })
    }

    let run
    try { run = verifyRunToken(body.runToken, runSecret) }
    catch (error) {
      if (error instanceof RunTokenError && error.payload) await updateRejectedRun(error.payload.runId, 'expired_token', 'expired')
      throw error
    }

    const playerName = normalizePlayerName(body.playerName)
    const nameError = validatePlayerName(playerName)
    if (nameError) {
      await updateRejectedRun(run.runId, 'invalid_name')
      return response.status(400).json({ message: nameError })
    }
    if (body.score < 0 || body.score > MAX_SCORE) {
      await updateRejectedRun(run.runId, 'invalid_score')
      return response.status(400).json({ message: 'Pontuação fora do limite.' })
    }
    if (body.score > maximumPlausibleScore(run.issuedAt)) {
      await updateRejectedRun(run.runId, 'implausible_score')
      return response.status(422).json({ message: 'A pontuação não é compatível com a duração da partida.' })
    }

    const { data, error } = await getSupabaseAdmin().rpc('submit_game_score', {
      p_run_id: run.runId, p_round_id: run.roundId, p_player_name: playerName, p_score: body.score,
    }).single()
    if (error) {
      if (error.message.includes('round_closed')) {
        await updateRejectedRun(run.runId, 'round_closed')
        return response.status(409).json({ message: 'A rodada foi encerrada. Inicie uma nova partida.' })
      }
      if (error.message.includes('reused_run') || error.code === '23505') {
        await updateRejectedRun(run.runId, 'reused_token')
        return response.status(409).json({ message: 'Esta tentativa já foi utilizada.' })
      }
      throw error
    }
    return response.status(201).json({ entry: toEntry(data as ScoreRow) })
  } catch (error) {
    if (error instanceof RunTokenError) return response.status(401).json({ message: 'A sessão desta partida expirou. Jogue novamente.' })
    console.error('leaderboard_error', error)
    return response.status(500).json({ message: 'Ranking temporariamente indisponível.' })
  }
}
