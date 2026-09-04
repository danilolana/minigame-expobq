import type { RankingEntry } from './ranking'

export type AdminStats = {
  started: number; accepted: number; rejected: number; uniquePlayers: number
  highScore: number; lowScore: number; averageScore: number; lastActivity: string | null
}
export type AdminRun = {
  runId: string; status: 'started' | 'accepted' | 'rejected' | 'expired'; score: number | null
  playerName: string | null; rejectionReason: string | null; startedAt: string; finishedAt: string | null
}
export type AdminDashboard = {
  round: { id: string; number: number; startedAt: string; active: boolean }
  stats: AdminStats; top: RankingEntry[]; latestRuns: AdminRun[]
}
export type RoundHistoryItem = {
  id: string; number: number; startedAt: string; endedAt: string | null; active: boolean
  participants: number; scoresCount: number; highScore: number; averageScore: number; winner: string | null
}

async function adminRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => null) as (T & { message?: string }) | null
  if (!response.ok) throw new Error(data?.message ?? 'O painel não respondeu.')
  if (!data) throw new Error('Resposta inválida do painel.')
  return data
}

export const getAdminSession = () => adminRequest<{ authenticated: true; username: string }>('/api/admin/session')
export const getAdminDashboard = () => adminRequest<AdminDashboard>('/api/admin/dashboard')
export const getRoundHistory = async () => (await adminRequest<{ rounds: RoundHistoryItem[] }>('/api/admin/rounds')).rounds
export const loginAdmin = (username: string, password: string) => adminRequest<{ authenticated: true; username: string }>('/api/admin/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
})
export const logoutAdmin = () => adminRequest<{ authenticated: false }>('/api/admin/logout', { method: 'POST' })
export const resetRanking = () => adminRequest<{ round: AdminDashboard['round'] }>('/api/admin/reset-ranking', { method: 'POST' })
