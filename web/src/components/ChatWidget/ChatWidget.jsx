import { useCallback, useEffect, useState } from 'react'
import ChatLauncher from './ChatLauncher.jsx'
import ChatHeader from './ChatHeader.jsx'
import MessageList from './MessageList.jsx'
import ChatComposer from './ChatComposer.jsx'
import LoginModal from './LoginModal.jsx'
import { useChat } from '../../hooks/useChat.js'
import { fetchConfig, logoutCustomer } from '../../lib/api.js'
import '../../styles/chat-widget.css'

// Used until /api/config answers, and if it never does.
const FALLBACK_VOICE = { enabled: true, recordSeconds: 4, language: 'en-US', autoSubmit: true }

export default function ChatWidget({ storeName = 'Store', greeting = '', onOpenChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [voice, setVoice] = useState(FALLBACK_VOICE)
  const [showLogin, setShowLogin] = useState(false)
  const [customerEmail, setCustomerEmail] = useState(null)

  // Lets an embedding page (e.g. the Shopify iframe snippet) resize its
  // frame to fit the launcher button vs. the full panel.
  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  const {
    messages,
    isThinking,
    status,
    sessionId,
    setSessionId,
    sendMessage,
    addSystemMessage,
    resetChat,
  } = useChat({ greeting })

  // Display and voice settings are owned by the server's config file, so the
  // widget asks for them rather than hardcoding a second copy.
  useEffect(() => {
    let cancelled = false
    fetchConfig()
      .then((config) => {
        if (!cancelled && config.voice) setVoice(config.voice)
      })
      .catch(() => {
        /* keep the fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * One action channel for everything rendered inside a message. A string is
   * a message to send; an object is a UI command (opening the sign-in modal).
   */
  const handleAction = useCallback(
    (action) => {
      if (typeof action === 'string') return sendMessage(action)
      if (action?.type === 'open-login') return setShowLogin(true)
    },
    [sendMessage],
  )

  function handleLoginSuccess(result) {
    setSessionId(result.sessionId)
    setCustomerEmail(result.email)
    setShowLogin(false)
    addSystemMessage(`Signed in as ${result.email}.`)
    // The buyer asked for orders before signing in; finish the job for them.
    sendMessage('Show me my recent orders')
  }

  async function handleSignOut() {
    try {
      await logoutCustomer({ sessionId })
    } catch {
      /* the local session is cleared either way */
    }
    setCustomerEmail(null)
    addSystemMessage('Signed out.')
  }

  function handleReset() {
    setCustomerEmail(null)
    resetChat()
  }

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
            customerEmail={customerEmail}
            onSignOut={handleSignOut}
            onReset={handleReset}
            onClose={() => setIsOpen(false)}
          />
          <MessageList
            messages={messages}
            isThinking={isThinking}
            onAction={handleAction}
          />
          <ChatComposer onSend={sendMessage} disabled={isThinking} voice={voice} />

          {showLogin && (
            <LoginModal
              sessionId={sessionId}
              storeName={storeName}
              onClose={() => setShowLogin(false)}
              onSuccess={handleLoginSuccess}
            />
          )}
        </section>
      )}

      <ChatLauncher isOpen={isOpen} onClick={() => setIsOpen((open) => !open)} />
    </div>
  )
}
