import { describe, expect, it } from 'vitest'
import { attemptReducer, initialAttempt } from './attempt'

describe('attemptReducer', () => {
  it('descarta localmente e invalida o token de salvamento', () => {
    const finished = attemptReducer(initialAttempt, { type: 'finish', score: 42, runToken: 'signed-run' })
    const discarded = attemptReducer(finished, { type: 'discard' })

    expect(discarded).toMatchObject({ status: 'discarded', score: 42, runToken: null })
  })

  it('marca uma partida sem token como indisponível para ranking', () => {
    expect(attemptReducer(initialAttempt, { type: 'finish', score: 10, runToken: null }).status).toBe('unavailable')
  })

  it('só conclui o salvamento depois do estado saving', () => {
    const finished = attemptReducer(initialAttempt, { type: 'finish', score: 21, runToken: 'signed-run' })
    expect(attemptReducer(finished, { type: 'saved' }).status).toBe('pending')
    expect(attemptReducer(attemptReducer(finished, { type: 'save' }), { type: 'saved' }).status).toBe('saved')
  })
})
