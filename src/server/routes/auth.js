import { Router } from 'express'
import { env } from '../../config/env.js'
import {
  buildAuthorizeUrl,
  createPkce,
  createStateToken,
  exchangeCode,
  isConfigured,
  CustomerAuthError,
  SETUP_HINT,
} from '../../shopify/customerAuth.js'
import { getSession } from '../../agent/state.js'
import { logger } from '../../utils/logger.js'

export const authRouter = Router()

/**
 * Passwordless customer sign-in (email OTP), via OAuth 2.0 + PKCE.
 *
 * The buyer's email and one-time code are entered on Shopify's hosted page —
 * they never pass through this server, the widget, or the model. All we ever
 * handle is the authorization code and the resulting token, and the token
 * stays on the server-side session.
 */

// state -> { sessionId, verifier, nonce, createdAt }. Short-lived by design:
// an unredeemed authorization attempt must not linger.
const pending = new Map()
const PENDING_TTL_MS = 10 * 60 * 1000

function sweepPending() {
  const cutoff = Date.now() - PENDING_TTL_MS
  for (const [state, entry] of pending) {
    if (entry.createdAt < cutoff) pending.delete(state)
  }
}

authRouter.post('/auth/start', async (req, res, next) => {
  const session = getSession(req.body?.sessionId)

  if (!isConfigured()) {
    logger.warn('sign-in attempted but no customer account client is configured')
    return res.status(503).json({
      // Buyer-facing text stays vague; the operator detail goes to the log.
      error: 'Sign-in is not available on this store yet.',
      setup: SETUP_HINT,
      callbackUri: env.authCallbackUrl,
      sessionId: session.id,
      configured: false,
    })
  }

  try {
    sweepPending()

    const state = createStateToken()
    const nonce = createStateToken()
    const { verifier, challenge } = createPkce()

    pending.set(state, {
      sessionId: session.id,
      verifier,
      nonce,
      createdAt: Date.now(),
    })

    const authorizeUrl = await buildAuthorizeUrl({
      state,
      nonce,
      codeChallenge: challenge,
    })

    res.json({ sessionId: session.id, authorizeUrl, configured: true })
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return res.status(503).json({ error: error.message, sessionId: session.id })
    }
    next(error)
  }
})

/**
 * Where Shopify sends the buyer back after they enter their code. Renders a
 * tiny page that closes itself; the widget learns the outcome by polling
 * /api/auth/status, which avoids any cross-origin postMessage fragility.
 */
authRouter.get('/auth/callback', async (req, res) => {
  const { code, state, error: oauthError, error_description: oauthDescription } = req.query

  if (oauthError) {
    logger.info('customer sign-in cancelled or failed', { error: oauthError })
    return res.status(400).send(closingPage(oauthDescription || 'Sign-in was cancelled.'))
  }

  const entry = state ? pending.get(state) : null
  if (!entry) {
    // Unknown or replayed state — this is the CSRF guard.
    return res.status(400).send(closingPage('That sign-in link has expired. Try again.'))
  }
  pending.delete(state)

  if (!code) {
    return res.status(400).send(closingPage('Sign-in did not complete.'))
  }

  try {
    const tokens = await exchangeCode({ code, codeVerifier: entry.verifier })
    const session = getSession(entry.sessionId)

    session.customerToken = tokens.accessToken
    session.customerRefreshToken = tokens.refreshToken
    session.customerTokenExpiresAt = tokens.expiresAt
    session.customerEmail = tokens.email

    logger.info('customer signed in via OTP', { sessionId: session.id })
    res.send(closingPage(null))
  } catch (error) {
    logger.error('customer sign-in failed', { message: error.message })
    res.status(400).send(closingPage('Sign-in could not be completed.'))
  }
})

authRouter.get('/auth/status', (req, res) => {
  const session = getSession(req.query.sessionId)
  res.json({
    sessionId: session.id,
    signedIn: Boolean(session.customerToken),
    email: session.customerEmail || null,
    configured: isConfigured(),
  })
})

authRouter.post('/auth/logout', (req, res) => {
  const session = getSession(req.body?.sessionId)
  session.customerToken = null
  session.customerRefreshToken = null
  session.customerTokenExpiresAt = null
  session.customerEmail = null
  res.json({ ok: true, sessionId: session.id })
})

/** Minimal self-closing page for the popup. No secrets are rendered into it. */
function closingPage(errorMessage) {
  const safe = errorMessage
    ? String(errorMessage).replace(/[<>&"]/g, (char) => `&#${char.charCodeAt(0)};`)
    : null

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${safe ? 'Sign-in failed' : 'Signed in'}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#12161c}
p{font-size:14px}</style></head>
<body>
<p>${safe || 'Signed in. You can close this window.'}</p>
<script>
  try { window.opener && window.opener.postMessage(
    { type: 'shopify-customer-auth', ok: ${safe ? 'false' : 'true'} },
    ${JSON.stringify(env.widgetOrigin)}
  ) } catch (e) {}
  setTimeout(function(){ window.close() }, ${safe ? 2500 : 400});
</script>
</body></html>`
}
