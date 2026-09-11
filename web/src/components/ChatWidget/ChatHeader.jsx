const STATUS_TEXT = {
  idle: 'Ready',
  ok: 'Connected',
  error: 'Connection problem',
}

export default function ChatHeader({ storeName, status = 'idle', onReset, onClose }) {
  return (
    <header className="cw__header">
      <div className="cw__identity">
        <span className="cw__avatar" aria-hidden="true">
          {storeName.charAt(0)}
        </span>
        <span className="cw__identity-text">
          <span className="cw__store">{storeName}</span>
          <span className="cw__status">
            <i className={`cw__status-dot cw__status-dot--${status}`} aria-hidden="true" />
            {STATUS_TEXT[status] || STATUS_TEXT.idle}
          </span>
        </span>
      </div>

      <div className="cw__header-actions">
        <button
          type="button"
          className="cw__icon-btn"
          onClick={onReset}
          aria-label="Start a new conversation"
          title="New conversation"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="cw__icon-btn"
          onClick={onClose}
          aria-label="Close chat"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
