/**
 * Client for the agent server (src/server).
 * Vite proxies /api to http://localhost:3000 in dev — see vite.config.js.
 */
const API_BASE = '/api'

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options)

  if (!response.ok) {
    // The server sends { error } for anything it handled deliberately.
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || `Request failed (${response.status})`)
  }

  return response.json()
}

export function sendChatMessage({ message, sessionId, signal }) {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
    signal,
  })
}

export function fetchConfig() {
  return request('/config', { method: 'GET' })
}

/**
 * Sign-in is passwordless: this only asks the server for the Shopify authorize
 * URL to open in a popup. The buyer's email and one-time code are entered on
 * Shopify's page, so no credential ever passes through here or through /chat.
 */
export function startAuth({ sessionId }) {
  return request('/auth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
}

export function fetchAuthStatus(sessionId) {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  return request(`/auth/status${suffix}`, { method: 'GET' })
}

export function logoutCustomer({ sessionId }) {
  return request('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
}
