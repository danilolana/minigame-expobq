import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const MAX_RUN_AGE_MS = 30 * 60 * 1000

type RunTokenPayload = {
  version: 1
  runId: string
  issuedAt: number
}

function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function assertRunSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < 32) throw new Error('RUN_TOKEN_SECRET must contain at least 32 characters.')
}

export function createRunToken(secret: string, now = Date.now()) {
  assertRunSecret(secret)
  const payload: RunTokenPayload = { version: 1, runId: randomUUID(), issuedAt: now }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded, secret)}`
}

export function verifyRunToken(token: string, secret: string, now = Date.now()) {
  assertRunSecret(secret)
  const [encoded, receivedSignature, extra] = token.split('.')
  if (!encoded || !receivedSignature || extra) throw new Error('Invalid run token.')

  const expectedSignature = signature(encoded, secret)
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('Invalid run token.')

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<RunTokenPayload>
  if (payload.version !== 1 || typeof payload.runId !== 'string' || typeof payload.issuedAt !== 'number') {
    throw new Error('Invalid run token.')
  }
  const age = now - payload.issuedAt
  if (age < -5_000 || age > MAX_RUN_AGE_MS) throw new Error('Expired run token.')
  return payload as RunTokenPayload
}

export function maximumPlausibleScore(issuedAt: number, now = Date.now()) {
  const seconds = Math.max(0, (now - issuedAt) / 1000) + 3
  const rawScore = seconds <= 35
    ? (220 * seconds + 4 * seconds ** 2) / 18
    : (12_600 + 500 * (seconds - 35)) / 18
  return Math.floor(rawScore + 40)
}
