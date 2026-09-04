import { readAdminSession } from '../_lib/admin-session.js'
import { methodNotAllowed, setApiHeaders, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { MAX_RUN_AGE_MS } from '../_lib/run-token.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET')
  if (!readAdminSession(request)) return response.status(401).json({ message: 'Não autorizado.' })
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('game_runs').update({
      status: 'expired', rejection_reason: 'expired_token', finished_at: new Date().toISOString(),
    }).eq('status', 'started').lt('started_at', new Date(Date.now() - MAX_RUN_AGE_MS).toISOString())
    const { data, error } = await supabase.rpc('get_admin_dashboard')
    if (error) throw error
    return response.status(200).json(data)
  } catch (error) {
    console.error('admin_dashboard_error', error)
    return response.status(500).json({ message: 'Não foi possível carregar o dashboard.' })
  }
}
