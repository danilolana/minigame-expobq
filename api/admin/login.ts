import { createSessionCookie, credentialsMatch } from '../_lib/admin-session.js'
import { methodNotAllowed, parseBody, setApiHeaders, type ApiRequest, type ApiResponse } from '../_lib/http.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST')
  const body = parseBody(request)
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string'
    || !credentialsMatch(body.username, body.password)) {
    return response.status(401).json({ message: 'Usuário ou senha inválidos.' })
  }
  response.setHeader('Set-Cookie', createSessionCookie(body.username))
  return response.status(200).json({ authenticated: true, username: body.username })
}
