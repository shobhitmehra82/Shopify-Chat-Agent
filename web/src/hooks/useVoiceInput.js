import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Fixed-duration speech capture using the browser's Web Speech API.
 *
 * Nothing is uploaded — recognition happens in the browser, so there is no
 * audio endpoint and no speech-to-text key. Unsupported in Firefox; callers
 * should hide the control when `supported` is false.
 *
 * The API stops on its own at the first pause, which would cut a buyer off
 * mid-sentence. Setting `continuous` and stopping on our own timer gives the
 * fixed window the config asks for instead.
 */
const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

const ERROR_TEXT = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings.',
  'service-not-allowed': 'Microphone access was blocked by your browser.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition could not reach the network.',
  'no-speech': "I didn't catch that — try again.",
}

export function useVoiceInput({
  seconds = 4,
  language = 'en-US',
  onInterim,
  onFinal,
} = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const timersRef = useRef([])

  // Keep callbacks in refs so recognition handlers never close over stale ones.
  const callbacksRef = useRef({ onInterim, onFinal })
  callbacksRef.current = { onInterim, onFinal }

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearInterval)
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const stop = useCallback(() => {
    clearTimers()
    // stop() lets the final result arrive; abort() would discard it.
    recognitionRef.current?.stop()
  }, [clearTimers])

  const start = useCallback(() => {
    if (!SpeechRecognition || recognitionRef.current) return

    setError(null)
    transcriptRef.current = ''

    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      if (final) transcriptRef.current += final
      callbacksRef.current.onInterim?.((transcriptRef.current + interim).trim())
    }

    recognition.onerror = (event) => {
      // 'aborted' just means we stopped it; not worth showing.
      if (event.error !== 'aborted') {
        setError(ERROR_TEXT[event.error] || 'Voice input failed. Try typing instead.')
      }
    }

    recognition.onend = () => {
      clearTimers()
      recognitionRef.current = null
      setIsRecording(false)
      setSecondsLeft(0)

      const text = transcriptRef.current.trim()
      transcriptRef.current = ''
      if (text) callbacksRef.current.onFinal?.(text)
      else setError((current) => current || ERROR_TEXT['no-speech'])
    }

    try {
      recognition.start()
    } catch {
      // Already-started races (React StrictMode double-invoke in dev).
      return
    }

    recognitionRef.current = recognition
    setIsRecording(true)
    setSecondsLeft(Math.ceil(seconds))

    timersRef.current.push(setTimeout(() => recognition.stop(), seconds * 1000))
    timersRef.current.push(
      setInterval(() => setSecondsLeft((left) => (left > 0 ? left - 1 : 0)), 1000),
    )
  }, [language, seconds, clearTimers])

  const toggle = useCallback(() => {
    if (isRecording) stop()
    else start()
  }, [isRecording, start, stop])

  useEffect(() => {
    return () => {
      clearTimers()
      const recognition = recognitionRef.current
      if (recognition) {
        // Unmounting: drop the result rather than submitting into a dead tree.
        recognition.onend = null
        recognition.abort()
        recognitionRef.current = null
      }
    }
  }, [clearTimers])

  return {
    supported: Boolean(SpeechRecognition),
    isRecording,
    secondsLeft,
    error,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  }
}
