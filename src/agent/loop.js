import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env.js'
import { catalogConfig } from '../config/catalog.config.js'
import { tools, executeTool } from '../tools/index.js'
import { buildSystemPrompt } from './prompt.js'
import { saveMessages } from './state.js'
import { UcpError } from '../ucp/errors.js'
import { logger } from '../utils/logger.js'

const client = new Anthropic({ apiKey: env.anthropicApiKey })

/**
 * Manual tool-use loop.
 *
 * Manual rather than the SDK tool runner because each tool returns two payloads
 * — a compact one for Claude and a rich one for the widget — and the runner has
 * nowhere to put the second.
 */
export async function runTurn({ session, userMessage, config = catalogConfig }) {
  const messages = [...session.messages, { role: 'user', content: userMessage }]
  const attachments = []
  const warnings = []

  let iterations = 0

  while (true) {
    if (iterations++ >= env.maxToolIterations) {
      logger.warn('tool loop hit iteration cap', { sessionId: session.id })
      break
    }

    const response = await client.messages.create({
      model: env.model,
      max_tokens: env.maxTokens,
      thinking: { type: 'adaptive' },
      // Stable prefix (system + tools) is cached; the volatile history follows it.
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(config),
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools,
      messages,
    })

    if (response.stop_reason === 'refusal') {
      messages.push({ role: 'assistant', content: response.content })
      saveMessages(session, messages)
      return {
        reply: 'I can\'t help with that request. Is there something else I can find for you?',
        attachments,
        warnings,
      }
    }

    // A server-side tool paused the turn; re-send to let it continue.
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content })
      continue
    }

    const toolUses = response.content.filter((block) => block.type === 'tool_use')

    // Always append the whole content array — it carries the thinking blocks,
    // which must go back unchanged on the next request.
    messages.push({ role: 'assistant', content: response.content })

    if (toolUses.length === 0) {
      saveMessages(session, messages)
      return { reply: extractText(response), attachments, warnings }
    }

    // Parallel tool calls must come back as tool_result blocks in ONE user
    // message, or Claude stops making parallel calls.
    // Cart mutations share session.cartId, so they run in sequence — two
    // parallel adds would both see "no cart yet" and create two carts.
    const results = []
    for (const toolUse of toolUses) {
      results.push(await runTool(toolUse, config, session, attachments, warnings))
    }
    messages.push({ role: 'user', content: results })
  }

  saveMessages(session, messages)
  return {
    reply: 'That took more steps than expected. Could you narrow the request a little?',
    attachments,
    warnings,
  }
}

async function runTool(toolUse, config, session, attachments, warnings) {
  try {
    const { forModel, forUi } = await executeTool(
      toolUse.name,
      toolUse.input,
      config,
      session,
    )

    if (forUi) attachments.push(forUi)
    if (Array.isArray(forModel?.warnings)) warnings.push(...forModel.warnings)

    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: JSON.stringify(forModel),
    }
  } catch (error) {
    logger.error('tool failed', {
      tool: toolUse.name,
      code: error.code,
      message: error.message,
    })

    // Hand the failure back as a result, not an exception — Claude can then
    // explain it to the buyer instead of the whole turn dying.
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      is_error: true,
      content:
        error instanceof UcpError
          ? `${error.message}. Tell the buyer: ${error.toBuyerMessage()}`
          : `Tool ${toolUse.name} failed: ${error.message}`,
    }
  }
}

function extractText(response) {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}
