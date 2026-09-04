import { describe, expect, it } from 'vitest'
import { createRunToken, maximumPlausibleScore, verifyRunToken } from './run-token'

const SECRET = 'a-secure-test-secret-with-more-than-32-characters'
const RUN_ID = '5a5ab164-f44f-41bf-839e-7a230860e03d'
const ROUND_ID = '9940e442-a79b-4798-9dfa-cb7e4ff5389f'

describe('run token', () => {
  it('assina e valida uma partida dentro da janela permitida', () => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID, 1_000)
    expect(verifyRunToken(token, SECRET, 2_000)).toMatchObject({ version: 2, runId: RUN_ID, roundId: ROUND_ID, issuedAt: 1_000 })
  })

  it('rejeita adulteração e expiração', () => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID, 1_000)
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
    expect(() => verifyRunToken(tampered, SECRET, 2_000)).toThrow('Invalid run token.')
    expect(() => verifyRunToken(token, SECRET, 2_000_000)).toThrow('Expired run token.')
  })

  it('impede alteração da rodada vinculada à partida', () => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID, 1_000)
    const [encoded, signature] = token.split('.')
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    payload.roundId = 'another-round'
    const tampered = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`
    expect(() => verifyRunToken(tampered, SECRET, 2_000)).toThrow('Invalid run token.')
  })

  it('calcula um teto crescente compatível com a física do jogo', () => {
    expect(maximumPlausibleScore(0, 10_000)).toBeGreaterThan(100)
    expect(maximumPlausibleScore(0, 30_000)).toBeGreaterThan(maximumPlausibleScore(0, 10_000))
  })
})
