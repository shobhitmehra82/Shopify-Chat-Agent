/**
 * Pure-math tests for the RAG helpers — chunking and vector ranking. No
 * network calls, no embedding API involved.
 *
 *   node scripts/rag-selftest.mjs
 */
import assert from 'node:assert/strict'
import { chunkText } from '../src/rag/chunk.js'
import { cosineSimilarity, topKMatches } from '../src/rag/similarity.js'

// ---------------------------------------------------------------- chunkText

{
  const short = 'One short sentence is well under the limit.'
  const chunks = chunkText(short, { maxChars: 200, overlapChars: 20 })
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0], short)
  console.log('✓ text shorter than maxChars stays as one chunk')
}

{
  const maxChars = 100
  const sentence = (i) => `Sentence number ${i} talks about the return policy.`
  const text = Array.from({ length: 10 }, (_, i) => sentence(i)).join(' ')
  const chunks = chunkText(text, { maxChars, overlapChars: 15 })

  assert.ok(chunks.length > 1, 'expected more than one chunk')
  for (const chunk of chunks) {
    assert.ok(chunk.length <= maxChars, `chunk of ${chunk.length} chars exceeds maxChars`)
  }
  console.log(`✓ long text splits into ${chunks.length} chunks, none over ${maxChars} chars`)
}

{
  const maxChars = 100
  const overlapChars = 15
  const sentence = (i) => `Sentence number ${i} talks about the return policy.`
  const text = Array.from({ length: 10 }, (_, i) => sentence(i)).join(' ')
  const chunks = chunkText(text, { maxChars, overlapChars })

  assert.ok(chunks.length > 1)
  for (let i = 1; i < chunks.length; i++) {
    const expectedOverlap = chunks[i - 1].slice(-overlapChars)
    assert.ok(
      chunks[i].startsWith(expectedOverlap),
      `chunk ${i} should start with the previous chunk's trailing ${overlapChars} chars`,
    )
  }
  console.log('✓ each chunk boundary carries the previous chunk\'s tail forward')
}

// ------------------------------------------------------ cosineSimilarity

{
  const a = [1, 0, 0]
  const b = [0, 1, 0]
  assert.equal(cosineSimilarity(a, a), 1)
  assert.equal(cosineSimilarity(a, b), 0)
  console.log('✓ cosineSimilarity: identical vectors = 1, orthogonal vectors = 0')
}

// ---------------------------------------------------------- topKMatches

{
  const query = [1, 0, 0]
  const entries = [
    { id: 'unrelated', vector: [0, 1, 0], text: 'unrelated' },
    { id: 'exact', vector: [1, 0, 0], text: 'exact match' },
    { id: 'near', vector: [0.9, 0.1, 0], text: 'near match' },
  ]
  const top = topKMatches(query, entries, 3)

  assert.equal(top[0].id, 'exact')
  assert.equal(top[1].id, 'near')
  assert.equal(top[2].id, 'unrelated')
  assert.ok(top[0].score > top[1].score, 'exact match should outscore near match')
  assert.ok(top[1].score > top[2].score, 'near match should outscore unrelated')
  assert.equal(top[2].score, 0, 'orthogonal vector scores exactly 0')
  console.log('✓ topKMatches ranks exact > near > unrelated (orthogonal = 0)')
}

console.log('\nAll RAG self-tests passed.')
