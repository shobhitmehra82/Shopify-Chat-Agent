import { randomUUID } from 'node:crypto'

/**
 * Per-session conversation state, in memory.
 *
 * Deliberately server-side: cart and checkout GIDs will live here in the next
 * step, and a client-supplied cart ID would be tamperable.
 *
 * In-process only — a restart or a second instance loses everything. Swap for
 * Redis before running more than one node.
 */
const SESSION_TTL_MS = 1000 * 60 * 60 // 1 hour idle
const MAX_HISTORY_MESSAGES = 40

const sessions = new Map()

export function getSession(sessionId) {
  const id = sessionId && sessions.has(sessionId) ? sessionId : randomUUID()

  let session = sessions.get(id)
  if (!session) {
    session = {
      id,
      messages: [],
      cartId: null,
      checkoutId: null,
      createdAt: Date.now(),
    }
    sessions.set(id, session)
  }

  session.lastSeenAt = Date.now()
  return session
}

export function saveMessages(session, messages) {
  // Trim oldest turns, but never start the history on a tool_result — that
  // orphans the tool_use it answers and the API rejects it.
  let trimmed = messages
  if (messages.length > MAX_HISTORY_MESSAGES) {
    trimmed = messages.slice(-MAX_HISTORY_MESSAGES)
    while (trimmed.length > 0 && startsWithToolResult(trimmed[0])) {
      trimmed = trimmed.slice(1)
    }
  }
  session.messages = trimmed
}

function startsWithToolResult(message) {
  return (
    message.role === 'user' &&
    Array.isArray(message.content) &&
    message.content.some((block) => block.type === 'tool_result')
  )
}

export function resetSession(sessionId) {
  sessions.delete(sessionId)
}

/** Drops idle sessions. Called on an interval by the server. */
export function sweepSessions(now = Date.now()) {
  let removed = 0
  for (const [id, session] of sessions) {
    if (now - session.lastSeenAt > SESSION_TTL_MS) {
      sessions.delete(id)
      removed++
    }
  }
  return removed
}

export function sessionCount() {
  return sessions.size
}
