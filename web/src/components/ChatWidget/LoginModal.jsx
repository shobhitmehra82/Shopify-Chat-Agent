import { useCallback, useEffect, useRef, useState } from 'react'
import { startAuth, fetchAuthStatus } from '../../lib/api.js'

/**
 * Passwordless sign-in.
 *
 * This store uses Shopify's new customer accounts: the buyer gets a one-time
 * code by email. Both the email and the code are entered on Shopify's own
 * hosted page in a popup — neither ever reaches this widget, our server, or
 * the model. When the popup finishes we poll /api/auth/status to learn the
 * outcome, which avoids depending on cross-origin postMessage.
 */
const POLL_MS = 1200
const GIVE_UP_MS = 5 * 60 * 1000

export default function LoginModal({ sessionId, storeName, onClose, onSuccess }) {
  const [phase, setPhase] = useState('idle') // idle | waiting | error
  const [error, setError] = useState(null)

  const popupRef = useRef(null)
  const pollRef = useRef(null)
  const startedAtRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopPolling()
      popupRef.current?.close?.()
    }
  }, [stopPolling])

  const beginPolling = useCallback(
    (activeSessionId) => {
      startedAtRef.current = Date.now()
      stopPolling()

      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAtRef.current > GIVE_UP_MS) {
          stopPolling()
          setPhase('error')
          setError('Sign-in timed out. Please try again.')
          return
        }

        try {
          const status = await fetchAuthStatus(activeSessionId)
          if (status.signedIn) {
            stopPolling()
            popupRef.current?.close?.()
            onSuccess({ sessionId: status.sessionId, email: status.email })
          }
        } catch {
          /* transient — keep polling until the deadline */
        }
      }, POLL_MS)
    },
    [onSuccess, stopPolling],
  )

  async function begin() {
    setError(null)
    setPhase('waiting')

    try {
      const { authorizeUrl, sessionId: activeSessionId } = await startAuth({ sessionId })

      popupRef.current = window.open(
        authorizeUrl,
        'shopify-signin',
        'width=460,height=680,menubar=no,toolbar=no',
      )

      if (!popupRef.current) {
        setPhase('error')
        setError('Your browser blocked the sign-in window. Allow popups and try again.')
        return
      }

      beginPolling(activeSessionId)
    } catch (startError) {
      setPhase('error')
      setError(startError.message)
    }
  }

  return (
    <div className="cw-modal" role="dialog" aria-modal="true" aria-labelledby="cw-login-title">
      <div className="cw-modal__backdrop" onClick={onClose} />

      <div className="cw-modal__panel">
        <h3 className="cw-modal__title" id="cw-login-title">
          Sign in to {storeName}
        </h3>
        <p className="cw-modal__subtitle">
          {phase === 'waiting'
            ? 'Finish signing in on the Shopify window — enter your email and the code we send you.'
            : `${storeName} will email you a one-time code. No password needed.`}
        </p>

        {error && (
          <p className="cw-modal__error" role="alert">
            {error}
          </p>
        )}

        <div className="cw-modal__actions">
          <button type="button" className="cw-modal__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="cw-modal__submit"
            onClick={begin}
            disabled={phase === 'waiting'}
          >
            {phase === 'waiting' ? 'Waiting…' : 'Continue with email'}
          </button>
        </div>

        <p className="cw-modal__note">
          Your email and code are entered on {storeName}&rsquo;s own sign-in page. This
          chat never sees them.
        </p>
      </div>
    </div>
  )
}
