import { createApp } from './server/app.js'
import { env, agentProfileIsLocal } from './config/env.js'
import { validateCatalogConfig } from './config/catalog.config.js'
import { sweepSessions } from './agent/state.js'
import {
  isConfigured,
  callbackUrlIsAcceptable,
  SETUP_HINT,
} from './shopify/customerAuth.js'
import { logger } from './utils/logger.js'

validateCatalogConfig()

const app = createApp()

const server = app.listen(env.port, () => {
  logger.info(`Shopify chat agent listening on http://localhost:${env.port}`)
  logger.info(`UCP endpoint: ${env.ucpEndpoint}`)
  logger.info(`Agent profile: ${env.agentProfileUrl}`)

  if (isConfigured()) {
    logger.info(`Customer sign-in: enabled (callback ${env.authCallbackUrl})`)
    if (!callbackUrlIsAcceptable()) {
      logger.warn(
        `Shopify rejects localhost and http:// callback URIs, so ${env.authCallbackUrl} ` +
          'cannot be registered. Set PUBLIC_BASE_URL to an HTTPS tunnel (ngrok, ' +
          'cloudflared) — the same tunnel the UCP agent profile needs.',
      )
    }
  } else {
    logger.info('Customer sign-in: disabled (CUSTOMER_ACCOUNT_CLIENT_ID not set)')
    logger.info(`  ${SETUP_HINT}`)
  }

  if (agentProfileIsLocal()) {
    logger.warn(
      'UCP_AGENT_PROFILE_URL points at localhost. Shopify fetches this URL ' +
        'server-side on every call and cannot reach your machine — every tool ' +
        'call will fail with profile_unreachable. Use a public tunnel, or leave ' +
        'it unset to use the store\'s own published profile for local dev.',
    )
  }
})

const sweeper = setInterval(
  () => {
    const removed = sweepSessions()
    if (removed > 0) logger.debug('swept idle sessions', { removed })
  },
  1000 * 60 * 10,
)
sweeper.unref()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`)
    server.close(() => process.exit(0))
  })
}
