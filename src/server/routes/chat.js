import { Router } from 'express'
import { runTurn } from '../../agent/loop.js'
import { getSession, resetSession } from '../../agent/state.js'
import { catalogConfig } from '../../config/catalog.config.js'
import { logger } from '../../utils/logger.js'

export const chatRouter = Router()

chatRouter.post('/chat', async (req, res, next) => {
  const { message, sessionId } = req.body || {}

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' })
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'message is too long' })
  }

  const session = getSession(sessionId)
  const started = Date.now()

  try {
    const { reply, attachments, warnings } = await runTurn({
      session,
      userMessage: message.trim(),
      config: catalogConfig,
    })

    logger.info('chat turn', {
      sessionId: session.id,
      ms: Date.now() - started,
      attachments: attachments.length,
    })

    res.json({
      sessionId: session.id,
      reply,
      attachments,
      warnings,
    })
  } catch (error) {
    next(error)
  }
})

chatRouter.post('/chat/reset', (req, res) => {
  const { sessionId } = req.body || {}
  if (sessionId) resetSession(sessionId)
  res.json({ ok: true })
})
