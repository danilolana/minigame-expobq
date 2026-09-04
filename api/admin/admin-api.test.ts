import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ApiRequest, ApiResponse } from '../_lib/http'
import dashboardHandler from './dashboard'
import loginHandler from './login'
import resetHandler from './reset-ranking'
import sessionHandler from './session'

function responseMock() {
  const result = { statusCode: 200, body: null as unknown, headers: {} as Record<string, string | string[]> }
  const response = {
    setHeader(name: string, value: string | string[]) { result.headers[name] = value },
    status(code: number) { result.statusCode = code; return response },
    json(body: unknown) { result.body = body; return response },
  } as unknown as ApiResponse
  return { response, result }
}

describe('admin API authentication', () => {
  beforeEach(() => {
    process.env.ADMIN_USERNAME = 'gestor'
    process.env.ADMIN_PASSWORD = 'senha-forte'
    process.env.ADMIN_SESSION_SECRET = 'segredo-de-sessao-com-mais-de-trinta-e-dois-caracteres'
  })
  afterEach(() => {
    delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_SESSION_SECRET
  })

  it('faz login correto e cria cookie de sessão', () => {
    const { response, result } = responseMock()
    loginHandler({ method: 'POST', body: { username: 'gestor', password: 'senha-forte' }, headers: {} } as ApiRequest, response)
    expect(result.statusCode).toBe(200)
    expect(result.headers['Set-Cookie']).toContain('HttpOnly')
  })

  it('rejeita login incorreto', () => {
    const { response, result } = responseMock()
    loginHandler({ method: 'POST', body: { username: 'gestor', password: 'errada' }, headers: {} } as ApiRequest, response)
    expect(result.statusCode).toBe(401)
  })

  it('reconhece a sessão criada pelo login', () => {
    const login = responseMock()
    loginHandler({ method: 'POST', body: { username: 'gestor', password: 'senha-forte' }, headers: {} } as ApiRequest, login.response)
    const cookie = String(login.result.headers['Set-Cookie']).split(';')[0]
    const session = responseMock()
    sessionHandler({ method: 'GET', headers: { cookie } } as ApiRequest, session.response)
    expect(session.result).toMatchObject({ statusCode: 200, body: { authenticated: true, username: 'gestor' } })
  })

  it('protege dashboard e reset sem sessão', async () => {
    const dashboard = responseMock(); const reset = responseMock()
    await dashboardHandler({ method: 'GET', headers: {} } as ApiRequest, dashboard.response)
    await resetHandler({ method: 'POST', headers: {} } as ApiRequest, reset.response)
    expect(dashboard.result.statusCode).toBe(401)
    expect(reset.result.statusCode).toBe(401)
  })
})
