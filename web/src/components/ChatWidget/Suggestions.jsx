const SUGGESTIONS = [
  'Show me some t-shirts',
  'What do you have under $100?',
  'Track my order',
]

export default function Suggestions({ onSelect }) {
  return (
    <div className="cw__suggestions">
      {SUGGESTIONS.map((text) => (
        <button
          key={text}
          type="button"
          className="cw__suggestion"
          onClick={() => onSelect(text)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
