import { env } from '../config/env.js'

const ENDPOINT = 'https://api.voyageai.com/v1/embeddings'

/** One vector per input text, in the same order. */
export async function embedTexts(texts, { model = 'voyage-3.5' } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return []
  if (!env.voyageApiKey) {
    throw new Error('VOYAGE_API_KEY is not set. Copy .env.example to .env and fill it in.')
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.voyageApiKey}`,
    },
    body: JSON.stringify({ input: texts, model }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Voyage embeddings request failed (${response.status}): ${detail}`)
  }

  const payload = await response.json()
  return payload.data.map((item) => item.embedding)
}
