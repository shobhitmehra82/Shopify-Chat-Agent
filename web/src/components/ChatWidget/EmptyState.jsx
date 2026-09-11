import Suggestions from './Suggestions.jsx'

export default function EmptyState({ onSuggestionClick }) {
  return (
    <div className="cw__empty">
      <p className="cw__empty-title">Start a conversation</p>
      <p className="cw__empty-body">Ask about products, your cart, or an order.</p>
      <Suggestions onSelect={onSuggestionClick} />
    </div>
  )
}
