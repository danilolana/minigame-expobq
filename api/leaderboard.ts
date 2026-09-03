import { createClient } from '@supabase/supabase-js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { MAX_SCORE, normalizePlayerName, validatePlayerName, type RankingEntry } from '../src/lib/ranking.js'
import { createRunToken, maximumPlausibleScore, verifyRunToken } from './_lib/run-token.js'

type ScoreRow = {
  id: string | number
  player_name: string
  score: number
  created_at: string
}

type ApiRequest = IncomingMessage & { body?: unknown }
type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse
  json(body: unknown): ApiResponse
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secretKey) throw new Error('Supabase environment is not configured.')
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function toEntry(row: ScoreRow): RankingEntry {
  return { id: String(row.id), playerName: row.player_name, score: row.score, createdAt: row.created_at }
}

function parseBody(request: ApiRequest) {
  if (typeof request.body === 'string') return JSON.parse(request.body) as unknown
  return request.body as unknown
}

async function getTopScores() {
  const { data, error } = await getSupabaseAdmin()
    .from('leaderboard_scores')
    .select('id, player_name, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10)
  if (error) throw error
  return (data as ScoreRow[]).map(toEntry)
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  try {
    if (request.method === 'GET') {
      return response.status(200).json({ entries: await getTopScores() })
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST')
      return response.status(405).json({ message: 'Método não permitido.' })
    }

    const body = parseBody(request)
    if (!body || typeof body !== 'object' || !('action' in body)) {
      return response.status(400).json({ message: 'Requisição inválida.' })
    }

    const runSecret = process.env.RUN_TOKEN_SECRET
    if (body.action === 'start') {
      return response.status(201).json({ runToken: createRunToken(runSecret ?? '') })
    }

    if (body.action !== 'save' || !('playerName' in body) || !('score' in body) || !('runToken' in body)) {
      return response.status(400).json({ message: 'Dados da tentativa incompletos.' })
    }

    if (typeof body.playerName !== 'string' || typeof body.runToken !== 'string' || typeof body.score !== 'number' || !Number.isInteger(body.score)) {
      return response.status(400).json({ message: 'Dados da tentativa inválidos.' })
    }

    const playerName = normalizePlayerName(body.playerName)
    const score = body.score
    const nameError = validatePlayerName(playerName)
    if (nameError) return response.status(400).json({ message: nameError })
    if (score < 0 || score > MAX_SCORE) return response.status(400).json({ message: 'Pontuação fora do limite.' })

    const run = verifyRunToken(body.runToken, runSecret ?? '')
    if (score > maximumPlausibleScore(run.issuedAt)) {
      return response.status(422).json({ message: 'A pontuação não é compatível com a duração da partida.' })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('leaderboard_scores')
      .insert({ run_id: run.runId, player_name: playerName, score })
      .select('id, player_name, score, created_at')
      .single()

    if (error?.code === '23505') return response.status(409).json({ message: 'Esta tentativa já foi salva.' })
    if (error) throw error
    return response.status(201).json({ entry: toEntry(data as ScoreRow) })
  } catch (error) {
    const knownMessage = error instanceof Error ? error.message : ''
    if (knownMessage === 'Invalid run token.' || knownMessage === 'Expired run token.') {
      return response.status(401).json({ message: 'A sessão desta partida expirou. Jogue novamente.' })
    }
    console.error('leaderboard_error', error)
    return response.status(500).json({ message: 'Ranking temporariamente indisponível.' })
  }
}
