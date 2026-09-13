/**
 * Shown when a tool reports the buyer is not signed in. Opening the modal is
 * the buyer's action, never the agent's.
 */
export default function AuthPrompt({ attachment, onAction }) {
  return (
    <div className="cw-auth">
      <p className="cw-auth__text">
        {attachment.reason || 'Sign in to your store account to see your orders.'}
      </p>
      <button
        type="button"
        className="cw-auth__button"
        onClick={() => onAction?.({ type: 'open-login' })}
      >
        Sign in
      </button>
    </div>
  )
}
