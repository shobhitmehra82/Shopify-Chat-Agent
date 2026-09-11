import { env } from '../config/env.js'

/**
 * Every UCP tool call must carry meta["ucp-agent"].profile. Shopify dereferences
 * that URL server-side on each call, so it has to be publicly reachable and must
 * return JSON containing `ucp.version`.
 */
export function buildMeta(extra = {}) {
  return {
    'ucp-agent': { profile: env.agentProfileUrl },
    ...extra,
  }
}

/**
 * The document this server publishes at /.well-known/ucp-agent.
 * `ucp.version` is the field Shopify validates — without it the call is
 * rejected with `version_unsupported`.
 */
export function buildAgentProfile() {
  return {
    ucp: {
      version: '2026-08-25',
      agent: {
        name: 'Shopify Chat Agent',
        description: 'Conversational shopping assistant built on Claude and UCP.',
        homepage: `https://${env.storeDomain}/`,
      },
      capabilities: {
        'dev.ucp.shopping.catalog.search': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.catalog.lookup': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.cart': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.checkout': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.order': [{ version: '2026-08-25' }],
      },
    },
  }
}
