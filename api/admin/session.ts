import { readAdminSession } from '../_lib/admin-session.js'
import { methodNotAllowed, setApiHeaders, type ApiRequest, type ApiResponse } from '../_lib/http.js'

export default function handler(request: ApiRequest, response: ApiResponse) {
  setApiHeaders(response)
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET')
  const session = readAdminSession(request)
  if (!session) return response.status(401).json({ authenticated: false })
  return response.status(200).json({ authenticated: true, username: session.username })
}
