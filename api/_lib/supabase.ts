import { createClient } from '@supabase/supabase-js'

export type RoundRow = { id: string; number: number; started_at: string; ended_at: string | null; active: boolean }

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secretKey) throw new Error('Supabase environment is not configured.')
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function getActiveRound(): Promise<RoundRow> {
  const { data, error } = await getSupabaseAdmin().from('leaderboard_rounds')
    .select('id, number, started_at, ended_at, active').eq('active', true).single()
  if (error) throw error
  return data as RoundRow
}
