import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ApiRequest } from './http.js'

const COOKIE_NAME = 'bq_admin_session'
const SESSION_AGE_SECONDS = 8 * 60 * 60
type SessionPayload = { username: string; expiresAt: number }

function requireSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters.')
  return secret
}
function sign(value: string) { return createHmac('sha256', requireSessionSecret()).update(value).digest('base64url') }
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
export function credentialsMatch(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME ?? ''
  const expectedPassword = process.env.ADMIN_PASSWORD ?? ''
  const usernameMatches = safeEqual(username, expectedUsername)
  const passwordMatches = safeEqual(password, expectedPassword)
  return Boolean(expectedUsername && expectedPassword) && usernameMatches && passwordMatches
}
export function createSessionCookie(username: string, now = Date.now()) {
  const payload: SessionPayload = { username, expiresAt: now + SESSION_AGE_SECONDS * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encoded}.${sign(encoded)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE_SECONDS}${secure}`
}
export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
}
export function readAdminSession(request: ApiRequest, now = Date.now()): SessionPayload | null {
  const raw = request.headers.cookie?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  if (!raw) return null
  const [encoded, received, extra] = raw.split('.')
  if (!encoded || !received || extra || !safeEqual(received, sign(encoded))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<SessionPayload>
    if (typeof payload.username !== 'string' || typeof payload.expiresAt !== 'number' || payload.expiresAt <= now) return null
    if (!safeEqual(payload.username, process.env.ADMIN_USERNAME ?? '')) return null
    return payload as SessionPayload
  } catch { return null }
}
