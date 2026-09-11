import { Router } from 'express'
import { env, agentProfileIsLocal } from '../../config/env.js'
import { sessionCount } from '../../agent/state.js'
import { catalogConfig } from '../../config/catalog.config.js'

export const healthRouter = Router()

healthRouter.get('/health', (req, res) => {
  res.json({
    ok: true,
    model: env.model,
    ucpEndpoint: env.ucpEndpoint,
    agentProfileUrl: env.agentProfileUrl,
    agentProfileReachableByShopify: !agentProfileIsLocal(),
    sessions: sessionCount(),
  })
})

/** The widget reads this to decide how to render results. */
healthRouter.get('/config', (req, res) => {
  res.json({
    display: catalogConfig.display,
    search: {
      sort: catalogConfig.search.sort,
      availableOnly: catalogConfig.search.availableOnly,
      resultLimit: catalogConfig.search.resultLimit,
    },
  })
})
