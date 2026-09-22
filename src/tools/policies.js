import { searchPolicies } from '../rag/policyIndex.js'

export async function searchStorePolicies(input = {}) {
  const question = String(input.question || '').trim()
  if (!question) {
    return { forModel: { found: false, error: 'A question is required.' }, forUi: null }
  }

  const { matches, reason } = await searchPolicies(question)

  if (matches.length === 0) {
    return {
      forModel: {
        found: false,
        note: `${reason} Tell the buyer the policy pages don't cover this — do not guess or invent an answer.`,
      },
      forUi: null,
    }
  }

  return {
    forModel: {
      found: true,
      results: matches.map((match) => ({
        source: match.pageTitle,
        text: match.text,
        score: Number(match.score.toFixed(3)),
      })),
      note: 'Answer using only this text. If it does not actually answer the question, say the policy pages do not cover it.',
    },
    forUi: null,
  }
}
