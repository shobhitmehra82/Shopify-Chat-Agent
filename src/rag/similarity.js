/**
 * Vector ranking. Pure — works on any equal-length numeric vectors — so it
 * can be exercised with synthetic ones, no embedding call required.
 */

export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have the same length (${a.length} vs ${b.length})`)
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * The k entries with the highest cosine similarity to queryVector, each
 * annotated with its score. `entries` are { id, vector, text, ...rest }.
 */
export function topKMatches(queryVector, entries, k) {
  return entries
    .map((entry) => ({ ...entry, score: cosineSimilarity(queryVector, entry.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}
