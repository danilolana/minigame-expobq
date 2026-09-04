import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

export function getPublicSupabase() {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  return client
}
