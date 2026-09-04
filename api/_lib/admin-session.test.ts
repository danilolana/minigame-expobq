import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionCookie, credentialsMatch, readAdminSession } from './admin-session'
import type { ApiRequest } from './http'

describe('admin session', () => {
  beforeEach(() => {
    process.env.ADMIN_USERNAME = 'gestor'
    process.env.ADMIN_PASSWORD = 'senha-forte-de-teste'
    process.env.ADMIN_SESSION_SECRET = 'segredo-de-sessao-com-mais-de-trinta-e-dois-caracteres'
  })
  afterEach(() => {
    delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_SESSION_SECRET
  })

  it('aceita credenciais exatas e rejeita senha incorreta', () => {
    expect(credentialsMatch('gestor', 'senha-forte-de-teste')).toBe(true)
    expect(credentialsMatch('gestor', 'incorreta')).toBe(false)
  })

  it('cria cookie HttpOnly e valida a sessão assinada', () => {
    const cookie = createSessionCookie('gestor', 1_000)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    const request = { headers: { cookie: cookie.split(';')[0] } } as ApiRequest
    expect(readAdminSession(request, 2_000)?.username).toBe('gestor')
    expect(readAdminSession(request, 40_000_000)).toBeNull()
  })

  it('rejeita cookie adulterado', () => {
    const cookie = createSessionCookie('gestor', 1_000).split(';')[0]
    const request = { headers: { cookie: `${cookie}x` } } as ApiRequest
    expect(readAdminSession(request, 2_000)).toBeNull()
  })
})
