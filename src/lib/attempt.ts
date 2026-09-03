export type AttemptStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'discarded' | 'unavailable' | 'error'

export type AttemptState = {
  status: AttemptStatus
  score: number
  runToken: string | null
  message: string
}

export type AttemptAction =
  | { type: 'reset' }
  | { type: 'finish'; score: number; runToken: string | null }
  | { type: 'save' }
  | { type: 'saved' }
  | { type: 'discard' }
  | { type: 'error'; message: string }

export const initialAttempt: AttemptState = { status: 'idle', score: 0, runToken: null, message: '' }

export function attemptReducer(state: AttemptState, action: AttemptAction): AttemptState {
  switch (action.type) {
    case 'reset':
      return initialAttempt
    case 'finish':
      return {
        status: action.runToken ? 'pending' : 'unavailable',
        score: action.score,
        runToken: action.runToken,
        message: action.runToken ? '' : 'Ranking indisponível nesta partida. Você ainda pode jogar novamente.',
      }
    case 'save':
      return state.status === 'pending' || state.status === 'error' ? { ...state, status: 'saving', message: '' } : state
    case 'saved':
      return state.status === 'saving' ? { ...state, status: 'saved', runToken: null, message: 'Pontuação salva no ranking global.' } : state
    case 'discard':
      return { ...state, status: 'discarded', runToken: null, message: 'Tentativa descartada. Nada foi enviado.' }
    case 'error':
      return { ...state, status: 'error', message: action.message }
  }
}
