import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse } from './_lib/http'
import { createRunToken, verifyRunToken } from './_lib/run-token'

const mocks = vi.hoisted(() => ({ getActiveRound: vi.fn(), getSupabaseAdmin: vi.fn() }))
vi.mock('./_lib/supabase.js', () => mocks)
import handler from './leaderboard'

const SECRET = 'segredo-de-run-token-com-mais-de-trinta-e-dois-caracteres'
const RUN_ID = '5a5ab164-f44f-41bf-839e-7a230860e03d'
const ROUND_ID = '9940e442-a79b-4798-9dfa-cb7e4ff5389f'

function responseMock() {
  const result = { statusCode: 200, body: null as unknown }
  const response = {
    setHeader() {}, status(code: number) { result.statusCode = code; return response },
    json(body: unknown) { result.body = body; return response },
  } as unknown as ApiResponse
  return { response, result }
}
function request(body?: unknown, method = 'POST') { return { method, body, headers: {} } as ApiRequest }
function updateChain() {
  const chain = { eq: vi.fn() } as { eq: ReturnType<typeof vi.fn> }
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('leaderboard API with rounds', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.RUN_TOKEN_SECRET = SECRET })

  it('cria uma partida e assina a rodada retornada pelo banco', async () => {
    mocks.getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { run_id: RUN_ID, round_id: ROUND_ID }, error: null }) }) })
    const { response, result } = responseMock()
    await handler(request({ action: 'start' }), response)
    expect(result.statusCode).toBe(201)
    const payload = verifyRunToken((result.body as { runToken: string }).runToken, SECRET)
    expect(payload).toMatchObject({ runId: RUN_ID, roundId: ROUND_ID })
  })

  it('retorna somente scores filtrados pela rodada ativa', async () => {
    mocks.getActiveRound.mockResolvedValue({ id: ROUND_ID, number: 4, started_at: '2026-09-04T10:00:00Z', active: true })
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 1, player_name: 'Ana', score: 80, created_at: '2026-09-04T10:01:00Z' }], error: null })
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit }
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain)
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) })
    const { response, result } = responseMock()
    await handler(request(undefined, 'GET'), response)
    expect(chain.eq).toHaveBeenCalledWith('round_id', ROUND_ID)
    expect(result.body).toMatchObject({ round: { number: 4 }, entries: [{ playerName: 'Ana', score: 80 }] })
  })

  it('salva score válido pela função transacional', async () => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID)
    const rpc = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 1, player_name: 'Ana', score: 0, created_at: '2026-09-04T10:01:00Z' }, error: null }) })
    mocks.getSupabaseAdmin.mockReturnValue({ rpc })
    const { response, result } = responseMock()
    await handler(request({ action: 'save', playerName: 'Ana', score: 0, runToken: token }), response)
    expect(result.statusCode).toBe(201)
    expect(rpc).toHaveBeenCalledWith('submit_game_score', expect.objectContaining({ p_round_id: ROUND_ID, p_run_id: RUN_ID }))
  })

  it('rejeita score inválido e registra o motivo', async () => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID)
    const updates = updateChain(); const update = vi.fn().mockReturnValue(updates)
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) })
    const { response, result } = responseMock()
    await handler(request({ action: 'save', playerName: 'Ana', score: -1, runToken: token }), response)
    expect(result.statusCode).toBe(400)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ rejection_reason: 'invalid_score' }))
  })

  it.each([
    ['round_closed', 409, 'rodada foi encerrada'],
    ['reused_run', 409, 'já foi utilizada'],
  ])('trata falha transacional %s', async (message, status, expected) => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID)
    const updates = updateChain()
    mocks.getSupabaseAdmin.mockImplementation(() => ({
      rpc: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { message, code: '' } }) }),
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(updates) }),
    }))
    const { response, result } = responseMock()
    await handler(request({ action: 'save', playerName: 'Ana', score: 0, runToken: token }), response)
    expect(result.statusCode).toBe(status)
    expect((result.body as { message: string }).message).toContain(expected)
  })

  it('rejeita token expirado', async () => {
    const token = createRunToken(SECRET, RUN_ID, ROUND_ID, 1_000)
    const updates = updateChain()
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(updates) }) })
    const { response, result } = responseMock()
    await handler(request({ action: 'save', playerName: 'Ana', score: 0, runToken: token }), response)
    expect(result.statusCode).toBe(401)
  })
})
