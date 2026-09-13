/**
 * Tells you whether customer sign-in is set up correctly, without opening a
 * browser.
 *
 *   npm run check-auth
 *
 * The client-ID probe works because the token endpoint answers `invalid_client`
 * for a client the store does not know, but a different error (`invalid_grant`)
 * once the client is real and only the authorization code is bad — which ours
 * deliberately is.
 */
import { env } from '../src/config/env.js'
import {
  discover,
  isConfigured,
  callbackUrlIsAcceptable,
  SETUP_HINT,
} from '../src/shopify/customerAuth.js'

const tick = (ok) => (ok ? '✓' : '✗')

console.log(`store            : ${env.storeDomain}`)

let endpoints
try {
  endpoints = await discover()
  console.log(`${tick(true)} discovery      : ${endpoints.issuer}`)
  console.log(`  authorize      : ${endpoints.authorization_endpoint}`)
  console.log(`  token          : ${endpoints.token_endpoint}`)
} catch (error) {
  console.log(`${tick(false)} discovery      : ${error.message}`)
  process.exit(1)
}

console.log()
console.log(`callback URI     : ${env.authCallbackUrl}`)
if (!callbackUrlIsAcceptable()) {
  console.log(
    `${tick(false)} Shopify rejects localhost and http:// callbacks.\n` +
      '  Set PUBLIC_BASE_URL to an HTTPS tunnel (ngrok / cloudflared) and register that URI.',
  )
} else {
  console.log(`${tick(true)} callback is https and not localhost`)
}

console.log()
if (!isConfigured()) {
  console.log(`${tick(false)} CUSTOMER_ACCOUNT_CLIENT_ID is not set.`)
  console.log()
  console.log(SETUP_HINT)
  process.exit(1)
}

// Deliberately invalid code: we only care which error comes back.
const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: env.customerClientId,
  code: 'probe-only-not-a-real-code',
  redirect_uri: env.authCallbackUrl,
  code_verifier: 'probe'.padEnd(43, 'x'),
})

const response = await fetch(endpoints.token_endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
})
const payload = await response.json().catch(() => ({}))

if (payload.error === 'invalid_client') {
  console.log(`${tick(false)} client id      : not recognised by this store`)
  console.log('  The id is wrong, or it belongs to a different shop.')
  console.log()
  console.log(SETUP_HINT)
  process.exit(1)
}

console.log(`${tick(true)} client id      : recognised by the store`)
console.log(`  (token endpoint said "${payload.error}", which is the expected`)
console.log('   rejection of the dummy code this script sends)')
console.log()
console.log('Remaining manual check: the callback URI above must be listed under')
console.log('Application setup in the Headless channel, character for character.')
