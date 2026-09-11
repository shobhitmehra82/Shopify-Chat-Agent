import { useState } from 'react'
import ChatLauncher from './ChatLauncher.jsx'
import ChatHeader from './ChatHeader.jsx'
import MessageList from './MessageList.jsx'
import ChatComposer from './ChatComposer.jsx'
import { useChat } from '../../hooks/useChat.js'
import '../../styles/chat-widget.css'

export default function ChatWidget({ storeName = 'Store', greeting = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const { messages, isThinking, status, sendMessage, resetChat } = useChat({ greeting })

  return (
    <div className="cw">
      {isOpen && (
        <section
          className="cw__panel"
          role="dialog"
          aria-label={`Chat with ${storeName}`}
        >
          <ChatHeader
            storeName={storeName}
            status={status}
            onReset={resetChat}
            onClose={() => setIsOpen(false)}
          />
          <MessageList
            messages={messages}
            isThinking={isThinking}
            onSuggestionClick={sendMessage}
          />
          <ChatComposer onSend={sendMessage} disabled={isThinking} />
        </section>
      )}

      <ChatLauncher isOpen={isOpen} onClick={() => setIsOpen((open) => !open)} />
    </div>
  )
}
