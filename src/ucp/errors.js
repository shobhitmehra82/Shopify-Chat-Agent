/**
 * UCP fails in three different ways, and only one of them looks like an error.
 *
 *   1. HTTP-level failure          -> throw
 *   2. JSON-RPC `error` object     -> throw (code -32001 is UCP discovery)
 *   3. HTTP 200 with `messages[]`  -> NOT an error, but the buyer must be told
 *      (out of stock, price changed, discount code rejected)
 *
 * Dropping case 3 is how an agent ends up telling someone a sold-out item is in
 * their cart, so `extractMessages` is called on every successful payload.
 */

export class UcpError extends Error {
  constructor(message, { code, data, tool } = {}) {
    super(message)
    this.name = 'UcpError'
    this.code = code
    this.data = data
    this.tool = tool
  }

  /** A short, buyer-safe explanation. */
  toBuyerMessage() {
    if (this.code === 'profile_unreachable' || this.code === 'invalid_profile_url') {
      return 'The store could not verify this shopping agent. Please try again shortly.'
    }
    if (this.code === 'version_unsupported') {
      return 'This shopping agent is not compatible with the store right now.'
    }
    return 'The store could not complete that request. Please try again.'
  }
}

/** Turns a JSON-RPC `error` member into a UcpError. */
export function fromJsonRpcError(error, tool) {
  const data = error?.data || {}
  const detail = data.content || error?.message || 'Unknown UCP error'
  return new UcpError(`${error?.message || 'UCP error'}: ${detail}`, {
    code: data.code || error?.code,
    data,
    tool,
  })
}

/**
 * Pulls the `messages[]` warnings out of a successful UCP payload.
 * Returns [] when there are none.
 */
export function extractMessages(payload) {
  if (!payload || !Array.isArray(payload.messages)) return []
  return payload.messages.map((message) => ({
    type: message.type || 'info',
    code: message.code || null,
    content: message.content || '',
  }))
}
