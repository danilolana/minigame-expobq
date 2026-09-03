import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRanking, normalizePlayerName, saveRankedAttempt, validatePlayerName } from './ranking'

afterEach(() => vi.unstubAllGlobals())

describe('ranking client', () => {
  it('normaliza espaços e valida nomes permitidos', () => {
    expect(normalizePlayerName('  Ana   BQ  ')).toBe('Ana BQ')
    expect(validatePlayerName('Ana_BQ-7')).toBeNull()
    expect(validatePlayerName('<script>')).toMatch(/apenas/)
    expect(validatePlayerName('A')).toMatch(/entre/)
  })

  it('carrega a lista retornada pela API', async () => {
    const entries = [{ id: '1', playerName: 'Ana', score: 99, createdAt: '2026-09-03T00:00:00Z' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries }), { status: 200 })))

    await expect(loadRanking()).resolves.toEqual(entries)
  })

  it('envia somente os dados necessários para salvar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entry: {} }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await saveRankedAttempt('  Ana  ', 33, 'signed-run')

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      action: 'save', playerName: 'Ana', score: 33, runToken: 'signed-run',
    })
  })

  it('propaga a mensagem segura da API em falhas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Tentativa expirada.' }), { status: 401 })))
    await expect(loadRanking()).rejects.toThrow('Tentativa expirada.')
  })
})
