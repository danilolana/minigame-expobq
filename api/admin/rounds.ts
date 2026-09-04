import { readAdminSession } from '../_lib/admin-session.js'
import { methodNotAllowed, setApiHeaders, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET')
  if (!readAdminSession(request)) return response.status(401).json({ message: 'Não autorizado.' })
  try {
    const { data, error } = await getSupabaseAdmin().rpc('get_round_history')
    if (error) throw error
    const rounds = (data as Record<string, unknown>[]).map((round) => ({
      id: round.id, number: round.number, startedAt: round.started_at, endedAt: round.ended_at,
      active: round.active, participants: Number(round.participants), scoresCount: Number(round.scores_count),
      highScore: Number(round.high_score), averageScore: Number(round.average_score), winner: round.winner,
    }))
    return response.status(200).json({ rounds })
  } catch (error) {
    console.error('admin_rounds_error', error)
    return response.status(500).json({ message: 'Não foi possível carregar o histórico.' })
  }
}
