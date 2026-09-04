import type { IncomingMessage, ServerResponse } from 'node:http'

export type ApiRequest = IncomingMessage & { body?: unknown }
export type ApiResponse = ServerResponse & { status(code: number): ApiResponse; json(body: unknown): ApiResponse }

export function parseBody(request: ApiRequest): Record<string, unknown> | null {
  try {
    const value = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch { return null }
}

export function setApiHeaders(response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
}

export function methodNotAllowed(response: ApiResponse, allowed: string) {
  response.setHeader('Allow', allowed)
  return response.status(405).json({ message: 'Método não permitido.' })
}
