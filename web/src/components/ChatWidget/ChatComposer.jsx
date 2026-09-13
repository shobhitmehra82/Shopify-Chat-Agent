import { useState } from 'react'
import { useVoiceInput } from '../../hooks/useVoiceInput.js'
import MicButton from './MicButton.jsx'

export default function ChatComposer({ onSend, disabled, voice = {} }) {
  const [draft, setDraft] = useState('')

  const {
    supported,
    isRecording,
    secondsLeft,
    error: voiceError,
    toggle,
    clearError,
  } = useVoiceInput({
    seconds: voice.recordSeconds ?? 4,
    language: voice.language ?? 'en-US',
    // Show words as they are recognised, so the buyer can see it working.
    onInterim: setDraft,
    onFinal: (text) => {
      if (voice.autoSubmit === false) {
        setDraft(text)
        return
      }
      setDraft('')
      onSend(text)
    },
  })

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

  const showMic = voice.enabled !== false && supported

  return (
    <div className="cw__composer-wrap">
      {voiceError && (
        <p className="cw__voice-error" role="status" onClick={clearError}>
          {voiceError}
        </p>
      )}

      <form className="cw__composer" onSubmit={submit}>
        <textarea
          className="cw__input"
          rows={1}
          value={draft}
          placeholder={
            isRecording ? 'Listening…' : 'Ask about products or orders…'
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Message"
          disabled={isRecording}
        />

        {showMic && (
          <MicButton
            isRecording={isRecording}
            secondsLeft={secondsLeft}
            disabled={disabled}
            onClick={toggle}
          />
        )}

        <button
          type="submit"
          className="cw__send"
          disabled={disabled || isRecording || draft.trim().length === 0}
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
    </div>
  )
}
