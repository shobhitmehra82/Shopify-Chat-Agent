import Anthropic from '@anthropic-ai/sdk'
import { UcpError } from '../../ucp/errors.js'
import { logger } from '../../utils/logger.js'

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, next) {
  if (error instanceof UcpError) {
    logger.error('ucp error', { code: error.code, message: error.message })
    return res.status(502).json({
      error: error.toBuyerMessage(),
      code: error.code,
    })
  }

  if (error instanceof Anthropic.RateLimitError) {
    logger.warn('anthropic rate limited')
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' })
  }

  if (error instanceof Anthropic.AuthenticationError) {
    logger.error('anthropic auth failed — check ANTHROPIC_API_KEY')
    return res.status(500).json({ error: 'The assistant is misconfigured.' })
  }

  if (error instanceof Anthropic.APIError) {
    logger.error('anthropic api error', { status: error.status, message: error.message })
    return res.status(502).json({ error: 'The assistant is unavailable right now.' })
  }

  logger.error('unhandled error', { message: error.message, stack: error.stack })
  res.status(500).json({ error: 'Something went wrong.' })
}
