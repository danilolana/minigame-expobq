import { describe, expect, it } from 'vitest'
import { createRunToken, maximumPlausibleScore, verifyRunToken } from './run-token'

const SECRET = 'a-secure-test-secret-with-more-than-32-characters'

describe('run token', () => {
  it('assina e valida uma partida dentro da janela permitida', () => {
    const token = createRunToken(SECRET, 1_000)
    expect(verifyRunToken(token, SECRET, 2_000)).toMatchObject({ version: 1, issuedAt: 1_000 })
  })

  it('rejeita adulteração e expiração', () => {
    const token = createRunToken(SECRET, 1_000)
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
    expect(() => verifyRunToken(tampered, SECRET, 2_000)).toThrow('Invalid run token.')
    expect(() => verifyRunToken(token, SECRET, 2_000_000)).toThrow('Expired run token.')
  })

  it('calcula um teto crescente compatível com a física do jogo', () => {
    expect(maximumPlausibleScore(0, 10_000)).toBeGreaterThan(100)
    expect(maximumPlausibleScore(0, 30_000)).toBeGreaterThan(maximumPlausibleScore(0, 10_000))
  })
})
