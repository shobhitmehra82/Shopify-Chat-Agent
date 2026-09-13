import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    )
  }
  return value
}

const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || 'agentic-training.myshopify.com'

export const env = {
  port: Number(process.env.PORT || 3000),
  storeDomain,

  /** Streamable-HTTP MCP endpoint for the store's UCP service. */
  ucpEndpoint: process.env.UCP_ENDPOINT || `https://${storeDomain}/api/ucp/mcp`,

  /**
   * Every UCP call carries meta["ucp-agent"].profile, and Shopify fetches that
   * URL server-side on each call. It must be reachable from the public internet
   * — http://localhost:3000 will NOT work.
   *
   * Default is the store's own published UCP document, which is a valid profile
   * and lets you develop without a tunnel. For anything real, host your own at
   * /.well-known/ucp-agent (this server already serves it) and point
   * UCP_AGENT_PROFILE_URL at its public URL.
   */
  agentProfileUrl:
    process.env.UCP_AGENT_PROFILE_URL || `https://${storeDomain}/.well-known/ucp`,

  ucpTimeoutMs: Number(process.env.UCP_TIMEOUT_MS || 20000),

  /**
   * Customer sign-in (Shopify new customer accounts, passwordless email OTP).
   *
   * Create the client in the Shopify admin under
   *   Settings -> Customer accounts -> Customer Account API
   * and register `${publicBaseUrl}/api/auth/callback` as a callback URI.
   * A public client needs only the id; a confidential client also sets the
   * secret. UCP cannot do any of this — it has no authentication.
   */
  customerClientId: process.env.CUSTOMER_ACCOUNT_CLIENT_ID || '',
  customerClientSecret: process.env.CUSTOMER_ACCOUNT_CLIENT_SECRET || '',

  /** Both overridable so the flow can be exercised against a stand-in. */
  customerAccountEndpoint: process.env.CUSTOMER_ACCOUNT_ENDPOINT || '',
  oidcDiscoveryUrl: process.env.OIDC_DISCOVERY_URL || '',

  /** Where Shopify redirects back to. Must match the registered callback URI. */
  get publicBaseUrl() {
    return process.env.PUBLIC_BASE_URL || `http://localhost:${this.port}`
  },
  get authCallbackUrl() {
    return `${this.publicBaseUrl}/api/auth/callback`
  },

  /** Origin of the page hosting the widget, for the popup handshake. */
  widgetOrigin: process.env.WIDGET_ORIGIN || 'http://localhost:5173',

  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
  maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 16000),

  /** Safety rail on the tool-use loop. */
  maxToolIterations: Number(process.env.MAX_TOOL_ITERATIONS || 8),

  logLevel: process.env.LOG_LEVEL || 'info',
}

/** True when the profile URL cannot be fetched by Shopify. */
export function agentProfileIsLocal() {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(env.agentProfileUrl)
}
