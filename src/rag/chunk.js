/**
 * Splits text into chunks on sentence boundaries, each no larger than
 * maxChars, carrying a little of the previous chunk forward so a sentence
 * split across the boundary doesn't lose its context.
 *
 * Pure — no I/O — so it can be exercised with plain strings.
 */

/** Naive but adequate: split on ./!/? followed by whitespace or end of text. */
function splitSentences(text) {
  const trimmed = text.trim()
  if (!trimmed) return []
  const matches = trimmed.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)
  return matches ? matches.map((sentence) => sentence.trim()).filter(Boolean) : [trimmed]
}

/** A single sentence longer than maxChars still can't be handed out whole. */
function hardSplit(text, maxChars) {
  const pieces = []
  for (let i = 0; i < text.length; i += maxChars) {
    pieces.push(text.slice(i, i + maxChars))
  }
  return pieces
}

const tail = (text, n) => (text.length <= n ? text : text.slice(text.length - n))

export function chunkText(text, { maxChars = 800, overlapChars = 100 } = {}) {
  if (maxChars <= 0) throw new Error('maxChars must be positive')
  if (typeof text !== 'string' || !text.trim()) return []

  const chunks = []
  let current = ''

  for (const sentence of splitSentences(text)) {
    const pieces = sentence.length > maxChars ? hardSplit(sentence, maxChars) : [sentence]

    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece
      if (candidate.length <= maxChars) {
        current = candidate
        continue
      }

      if (current) chunks.push(current)

      const overlap = overlapChars > 0 ? tail(current, overlapChars) : ''
      const withOverlap = overlap ? `${overlap} ${piece}` : piece
      current = withOverlap.length <= maxChars ? withOverlap : piece
    }
  }

  if (current) chunks.push(current)
  return chunks
}
