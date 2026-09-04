import { clearSessionCookie } from '../_lib/admin-session.js'
import { methodNotAllowed, setApiHeaders, type ApiRequest, type ApiResponse } from '../_lib/http.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST')
  response.setHeader('Set-Cookie', clearSessionCookie())
  return response.status(200).json({ authenticated: false })
}
