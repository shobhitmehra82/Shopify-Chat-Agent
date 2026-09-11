import { useCallback, useRef, useState } from 'react'
import { sendChatMessage } from '../lib/api.js'

let nextId = 0
const createMessage = (role, content, extra = {}) => ({
  id: `m${nextId++}`,
  role,
  content,
  ...extra,
})

export function useChat({ greeting = '' } = {}) {
  const initialMessages = greeting ? [createMessage('assistant', greeting)] : []

  const [messages, setMessages] = useState(initialMessages)
  const [isThinking, setIsThinking] = useState(false)
  const [status, setStatus] = useState('idle') // idle | ok | error

  const sessionIdRef = useRef(null)
  const inFlightRef = useRef(null)

  const sendMessage = useCallback(async (text) => {
    if (inFlightRef.current) return

    setMessages((current) => [...current, createMessage('user', text)])
    setIsThinking(true)

    const controller = new AbortController()
    inFlightRef.current = controller

    try {
      const data = await sendChatMessage({
        message: text,
        sessionId: sessionIdRef.current,
        signal: controller.signal,
      })

      sessionIdRef.current = data.sessionId
      setStatus('ok')

      setMessages((current) => [
        ...current,
        createMessage('assistant', data.reply, {
          attachments: data.attachments || [],
        }),
      ])
    } catch (error) {
      if (error.name === 'AbortError') return
      setStatus('error')
      setMessages((current) => [
        ...current,
        createMessage('system', error.message || 'Something went wrong.'),
      ])
    } finally {
      inFlightRef.current = null
      setIsThinking(false)
    }
  }, [])

  const resetChat = useCallback(() => {
    inFlightRef.current?.abort()
    inFlightRef.current = null
    sessionIdRef.current = null
    setMessages(greeting ? [createMessage('assistant', greeting)] : [])
    setIsThinking(false)
    setStatus('idle')
  }, [greeting])

  return { messages, isThinking, status, sendMessage, resetChat }
}
