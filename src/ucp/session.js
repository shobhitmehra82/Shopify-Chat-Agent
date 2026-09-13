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
      // `services` is mandatory — Shopify rejects a profile without it as
      // `profile_malformed: Missing services`, even when everything else is
      // present. It declares which UCP services this agent speaks.
      services: {
        'dev.ucp.shopping': [
          {
            version: '2026-08-25',
            transport: 'mcp',
            spec: 'https://ucp.dev/2026-08-25/specification/overview/',
          },
        ],
      },
      capabilities: {
        'dev.ucp.shopping.catalog.search': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.catalog.lookup': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.cart': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.checkout': [{ version: '2026-08-25' }],
        'dev.ucp.shopping.order': [{ version: '2026-08-25' }],
      },
      // Also mandatory: without it Shopify rejects the profile as
      // `profile_malformed: Missing payment handlers`. These declare which
      // payment handlers this agent can drive at checkout, and must overlap
      // with what the store advertises in its own /.well-known/ucp.
      payment_handlers: {
        'dev.shopify.card': [{ version: '2026-01-15' }],
      },
    },
  }
}
