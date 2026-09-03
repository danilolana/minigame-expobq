export const PLAYER_NAME_MIN_LENGTH = 2
export const PLAYER_NAME_MAX_LENGTH = 18
export const MAX_SCORE = 100_000

export type RankingEntry = {
  id: string
  playerName: string
  score: number
  createdAt: string
}

export type SavedAttempt = {
  entry: RankingEntry
}

export function normalizePlayerName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function validatePlayerName(value: string) {
  const name = normalizePlayerName(value)
  if (name.length < PLAYER_NAME_MIN_LENGTH || name.length > PLAYER_NAME_MAX_LENGTH) {
    return `Use entre ${PLAYER_NAME_MIN_LENGTH} e ${PLAYER_NAME_MAX_LENGTH} caracteres.`
  }
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) {
    return 'Use apenas letras, números, espaço, ponto, hífen ou sublinhado.'
  }
  return null
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const data = await response.json().catch(() => null) as ({ message?: string } & T) | null
  if (!response.ok) throw new Error(data?.message ?? 'O ranking não respondeu. Tente novamente.')
  if (!data) throw new Error('O ranking retornou uma resposta inválida.')
  return data
}

export async function loadRanking(signal?: AbortSignal) {
  const data = await requestJson<{ entries: RankingEntry[] }>('/api/leaderboard', { signal })
  return data.entries
}

export async function startRankedRun() {
  const data = await requestJson<{ runToken: string }>('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  })
  return data.runToken
}

export async function saveRankedAttempt(playerName: string, score: number, runToken: string) {
  return requestJson<SavedAttempt>('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'save',
      playerName: normalizePlayerName(playerName),
      score,
      runToken,
    }),
  })
}
