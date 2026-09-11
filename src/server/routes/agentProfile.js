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
  res.set('Cache-Control', 'public, max-age=300')
  res.json(buildAgentProfile())
})
