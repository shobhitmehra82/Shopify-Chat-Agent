import { Router } from 'express'
import { buildAgentProfile } from '../../ucp/session.js'

export const agentProfileRouter = Router()

/**
 * Shopify fetches this URL server-side on every UCP tool call, to resolve
 * meta["ucp-agent"].profile. It is mounted at the root, not under /api,
 * because the URL we advertise has to be exactly this.
 *
 * It must be reachable from the public internet — see env.agentProfileUrl.
 */
agentProfileRouter.get('/.well-known/ucp-agent', (req, res) => {
  // Shopify honours this, and it re-fetches on every tool call, so some
  // caching is worth having. Keep it short: a longer TTL means an edit to the
  // profile silently keeps failing until the old copy expires, which is
  // indistinguishable from the fix not working.
  res.set('Cache-Control', 'public, max-age=60')
  res.json(buildAgentProfile())
})
