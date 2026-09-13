import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'
import TypingIndicator from './TypingIndicator.jsx'
import EmptyState from './EmptyState.jsx'
import Suggestions from './Suggestions.jsx'

export default function MessageList({ messages, isThinking, onAction }) {
  const endRef = useRef(null)
  const hasUserMessage = messages.some((message) => message.role === 'user')

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, isThinking])

  return (
    <div className="cw__messages" role="log" aria-live="polite">
      {messages.length === 0 && <EmptyState onSuggestionClick={onAction} />}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onAction={onAction} />
      ))}

      {isThinking && <TypingIndicator />}

      {/* A greeting counts as a message, so the chips live here too — otherwise
          they would never render for a widget configured with one. */}
      {messages.length > 0 && !hasUserMessage && !isThinking && (
        <Suggestions onSelect={onAction} />
      )}

      <div ref={endRef} />
    </div>
  )
}
