import { createHash, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * Shopify new customer accounts — passwordless (email OTP) sign-in.
 *
 * The store uses new customer accounts, so there is no password to collect:
 * the buyer receives a one-time code by email and enters it on Shopify's own
 * hosted login page. We never see the email code and never see a password.
 * Our part is the OAuth 2.0 authorization-code flow with PKCE around it:
 *
 *   1. /api/auth/start     -> build an authorize URL, open it in a popup
 *   2. Shopify             -> buyer enters email, gets the OTP, enters it
 *   3. /api/auth/callback  -> Shopify redirects back with ?code
 *   4. token exchange      -> access token, stored server-side on the session
 *
 * Endpoints are discovered from the store's OpenID configuration rather than
 * hardcoded, so this works against any shop without knowing its numeric id.
 */

export class CustomerAuthError extends Error {
  constructor(message, { code } = {}) {
    super(message)
    this.name = 'CustomerAuthError'
    this.code = code
  }
}

let discoveryCache = null
let discoveryFetchedAt = 0
const DISCOVERY_TTL_MS = 60 * 60 * 1000

/** OpenID configuration for the shop, cached for an hour. */
export async function discover() {
  if (discoveryCache && Date.now() - discoveryFetchedAt < DISCOVERY_TTL_MS) {
    return discoveryCache
  }

  const url =
    env.oidcDiscoveryUrl ||
    `https://${env.storeDomain}/.well-known/openid-configuration`
  const response = await fetch(url)
  if (!response.ok) {
    throw new CustomerAuthError(
      `Could not read the store's OpenID configuration (${response.status}).`,
      { code: 'discovery_failed' },
    )
  }

  discoveryCache = await response.json()
  discoveryFetchedAt = Date.now()
  logger.info('discovered customer auth endpoints', { issuer: discoveryCache.issuer })
  return discoveryCache
}

export function isConfigured() {
  return Boolean(env.customerClientId)
}

/**
 * Where the client ID actually comes from.
 *
 * It is NOT under Settings -> Customer accounts. Customer Account API
 * credentials are issued by the Headless (or Hydrogen) sales channel:
 *
 *   1. Install the "Headless" channel from the Shopify App Store
 *   2. Sales channels -> Headless -> select your storefront
 *   3. "Customer Account API settings" -> Credentials  = the client ID
 *   4. Same page -> "Application setup" -> Callback URI(s) and JavaScript origins
 *
 * Shopify rejects localhost and any plain-http URL for callbacks, so local
 * development needs an HTTPS tunnel.
 */
export const SETUP_HINT =
  'Install the Headless sales channel, then: Sales channels -> Headless -> your ' +
  'storefront -> Customer Account API settings. Copy the client ID from Credentials ' +
  'into CUSTOMER_ACCOUNT_CLIENT_ID, and add your callback URI under Application setup. ' +
  'Shopify rejects localhost and http:// callbacks, so use an HTTPS tunnel in dev.'

function assertConfigured() {
  if (!isConfigured()) {
    throw new CustomerAuthError(
      `Customer sign-in is not configured. ${SETUP_HINT} Callback URI to register: ${env.authCallbackUrl}`,
      { code: 'not_configured' },
    )
  }
}

/** Shopify will not accept a localhost or http callback URI. */
export function callbackUrlIsAcceptable() {
  return /^https:\/\//i.test(env.authCallbackUrl) && !/\/\/localhost|\/\/127\./i.test(env.authCallbackUrl)
}

const base64url = (buffer) => buffer.toString('base64url')

/** PKCE pair. S256 is the only challenge method the store advertises. */
export function createPkce() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function createStateToken() {
  return base64url(randomBytes(24))
}

/** The URL the popup opens. Shopify handles email entry and the OTP. */
export async function buildAuthorizeUrl({ state, nonce, codeChallenge }) {
  assertConfigured()
  const { authorization_endpoint } = await discover()

  const url = new URL(authorization_endpoint)
  url.searchParams.set('client_id', env.customerClientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', env.authCallbackUrl)
  // customer-account-api:full is what lets us read their orders.
  url.searchParams.set('scope', 'openid email customer-account-api:full')
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  return url.toString()
}

/** Swaps the authorization code for tokens. */
export async function exchangeCode({ code, codeVerifier }) {
  assertConfigured()
  const { token_endpoint } = await discover()

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.customerClientId,
    redirect_uri: env.authCallbackUrl,
    code,
    code_verifier: codeVerifier,
  })

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  // Public clients use PKCE alone; confidential clients also send the secret.
  if (env.customerClientSecret) {
    const basic = Buffer.from(
      `${env.customerClientId}:${env.customerClientSecret}`,
    ).toString('base64')
    headers.Authorization = `Basic ${basic}`
  }

  const response = await fetch(token_endpoint, { method: 'POST', headers, body })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    logger.error('token exchange failed', {
      status: response.status,
      error: payload?.error,
      description: payload?.error_description,
    })
    throw new CustomerAuthError(
      payload?.error_description || 'Sign-in could not be completed.',
      { code: payload?.error || `http_${response.status}` },
    )
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || null,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : null,
    email: emailFromIdToken(payload.id_token),
  }
}

export async function refresh(refreshToken) {
  assertConfigured()
  const { token_endpoint } = await discover()

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.customerClientId,
    refresh_token: refreshToken,
  })

  const response = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new CustomerAuthError('Your session expired. Please sign in again.', {
      code: 'refresh_failed',
    })
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : null,
  }
}

export async function buildLogoutUrl(idToken) {
  const { end_session_endpoint } = await discover()
  if (!end_session_endpoint) return null
  const url = new URL(end_session_endpoint)
  if (idToken) url.searchParams.set('id_token_hint', idToken)
  return url.toString()
}

/**
 * Reads the email claim out of the id_token.
 *
 * The signature is not verified: the token came straight from the token
 * endpoint over TLS, which OIDC treats as sufficient. Verify against the JWKS
 * if you ever accept an id_token from somewhere other than that response.
 */
function emailFromIdToken(idToken) {
  if (!idToken) return null
  try {
    const [, payload] = idToken.split('.')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return claims.email || null
  } catch {
    return null
  }
}
