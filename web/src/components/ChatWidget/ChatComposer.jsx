import { useState } from 'react'

export default function ChatComposer({ onSend, disabled }) {
  const [draft, setDraft] = useState('')

  function submit(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || disabled) return
    onSend(text)
    setDraft('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      submit(event)
    }
  }

  return (
    <form className="cw__composer" onSubmit={submit}>
      <textarea
        className="cw__input"
        rows={1}
        value={draft}
        placeholder="Ask about products, cart, or orders…"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Message"
      />
      <button
        type="submit"
        className="cw__send"
        disabled={disabled || draft.trim().length === 0}
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M4 12 20 4l-8 16-2-6-6-2Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  )
}
