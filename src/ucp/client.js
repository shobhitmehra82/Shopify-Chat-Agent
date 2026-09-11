import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { UcpError, fromJsonRpcError } from './errors.js'
import { buildMeta } from './session.js'

let requestId = 0

/**
 * Minimal MCP client for Shopify's Streamable HTTP endpoint.
 *
 * The endpoint is stateless — no session header, no initialize handshake needed
 * before tools/call — so this is a plain JSON-RPC 2.0 POST.
 */
async function rpc(method, params, { timeoutMs = env.ucpTimeoutMs } = {}) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(env.ucpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The server may answer as JSON or as an SSE stream; accept both.
        Accept: 'application/json, text/event-stream',
      },
      body,
      signal: controller.signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new UcpError(`UCP request timed out after ${timeoutMs}ms`, {
        code: 'timeout',
      })
    }
    throw new UcpError(`UCP request failed: ${error.message}`, { code: 'network' })
  } finally {
    clearTimeout(timer)
  }

  const raw = await response.text()

  if (!response.ok) {
    throw new UcpError(`UCP HTTP ${response.status}`, {
      code: `http_${response.status}`,
      data: { body: raw.slice(0, 500) },
    })
  }

  const envelope = parseEnvelope(raw, response.headers.get('content-type') || '')

  if (envelope.error) throw fromJsonRpcError(envelope.error, method)
  return envelope.result
}

/**
 * The response is either a JSON-RPC object or an SSE stream whose `data:` lines
 * carry one. Normalise both to the object.
 */
function parseEnvelope(raw, contentType) {
  const text = contentType.includes('text/event-stream')
    ? raw
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('')
    : raw

  try {
    return JSON.parse(text)
  } catch {
    throw new UcpError('UCP returned a response that is not valid JSON', {
      code: 'bad_payload',
      data: { body: raw.slice(0, 500) },
    })
  }
}

/**
 * Calls a UCP tool and returns the decoded payload.
 *
 * MCP wraps the UCP object as a text content block, so the result has to be
 * JSON.parse'd a second time. That happens here, once, so no caller has to
 * think about it.
 */
export async function callTool(name, args, { meta = {}, timeoutMs } = {}) {
  const started = Date.now()

  const result = await rpc(
    'tools/call',
    { name, arguments: { ...args, meta: buildMeta(meta) } },
    { timeoutMs },
  )

  logger.debug('ucp tool call', { tool: name, ms: Date.now() - started })

  // MCP can flag a tool-level failure without a JSON-RPC error.
  if (result?.isError) {
    throw new UcpError(`UCP tool ${name} reported an error`, {
      code: 'tool_error',
      data: result,
      tool: name,
    })
  }

  const text = result?.content?.[0]?.text
  if (typeof text !== 'string') {
    throw new UcpError(`UCP tool ${name} returned no text content`, {
      code: 'empty_payload',
      tool: name,
    })
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new UcpError(`UCP tool ${name} returned unparseable content`, {
      code: 'bad_payload',
      data: { text: text.slice(0, 500) },
      tool: name,
    })
  }
}

/** MCP handshake. Only needed for diagnostics — tools/call works without it. */
export function initialize() {
  return rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'shopify-chat-agent', version: '1.0.0' },
  })
}

/** Lists the tools the store exposes. Used by scripts/probe-ucp.js. */
export function listTools() {
  return rpc('tools/list', {})
}
