import { readAdminSession } from '../_lib/admin-session.js'
import { methodNotAllowed, setApiHeaders, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST')
  const session = readAdminSession(request)
  if (!session) return response.status(401).json({ message: 'Não autorizado.' })
  try {
    const { data, error } = await getSupabaseAdmin().rpc('reset_leaderboard_round', { p_created_by: session.username }).single()
    if (error) throw error
    const round = data as { id: string; number: number; started_at: string; active: boolean }
    return response.status(201).json({
      round: { id: round.id, number: round.number, startedAt: round.started_at, active: round.active },
    })
  } catch (error) {
    console.error('admin_reset_error', error)
    return response.status(500).json({ message: 'Não foi possível reiniciar o ranking.' })
  }
}
