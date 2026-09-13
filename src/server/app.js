import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { chatRouter } from './routes/chat.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { agentProfileRouter } from './routes/agentProfile.js'
import { errorHandler } from './middleware/errorHandler.js'

const here = dirname(fileURLToPath(import.meta.url))
const widgetDist = join(here, '../../web/dist')

export function createApp() {
  const app = express()

  app.use(express.json({ limit: '64kb' }))

  // Mounted at the root: Shopify fetches this exact URL.
  app.use(agentProfileRouter)

  // Everything the widget talks to. Vite proxies /api here in dev.
  app.use('/api', healthRouter)
  app.use('/api', authRouter)
  app.use('/api', chatRouter)

  // Serve the built widget if `npm run build` has been run in web/.
  if (existsSync(widgetDist)) {
    app.use(express.static(widgetDist))
  }

  app.use(errorHandler)

  return app
}
