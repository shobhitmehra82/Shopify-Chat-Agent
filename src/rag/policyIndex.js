import { chunkText } from './chunk.js'
import { topKMatches } from './similarity.js'
import { embedTexts } from './embeddings.js'
import { policyPages } from '../data/policyPages.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * In-memory RAG index over the store's policy pages.
 *
 * Built once at startup (buildPolicyIndex): chunk every page, embed every
 * chunk, hold the { id, vector, text } list in memory. search_store_policies
 * then embeds the incoming question with the same embedTexts function and
 * ranks against this list — nothing is re-embedded per request except the
 * question itself.
 */

const CHUNK_OPTIONS = { maxChars: 700, overlapChars: 120 }

// Below this, a "match" is closer to noise than to an answer — the tool
// should say the policies don't cover it rather than hand Claude a stretch.
const SIMILARITY_THRESHOLD = 0.5

let index = []
let ready = false

export function isPolicyIndexReady() {
  return ready
}

export async function buildPolicyIndex() {
  if (!env.voyageApiKey) {
    logger.warn('VOYAGE_API_KEY not set — search_store_policies will report unavailable')
    return
  }

  const chunks = policyPages.flatMap((page) =>
    chunkText(page.text, CHUNK_OPTIONS).map((text, position) => ({
      id: `${page.id}#${position}`,
      pageTitle: page.title,
      text,
    })),
  )

  if (chunks.length === 0) return

  const vectors = await embedTexts(chunks.map((chunk) => chunk.text))
  index = chunks.map((chunk, i) => ({ ...chunk, vector: vectors[i] }))
  ready = true
  logger.info('policy index built', { pages: policyPages.length, chunks: index.length })
}

/** @returns {{ matches: Array, reason: string|null }} */
export async function searchPolicies(question, { k = 3 } = {}) {
  if (!ready) {
    return { matches: [], reason: 'Store-policy search is not available right now.' }
  }

  const [queryVector] = await embedTexts([question])
  const matches = topKMatches(queryVector, index, k).filter(
    (match) => match.score >= SIMILARITY_THRESHOLD,
  )

  return {
    matches,
    reason: matches.length ? null : 'Nothing in the policy pages matched that closely enough.',
  }
}
