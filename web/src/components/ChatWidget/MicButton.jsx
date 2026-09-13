export default function MicButton({ isRecording, secondsLeft, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`cw__mic ${isRecording ? 'cw__mic--recording' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={isRecording ? 'Stop recording' : 'Record a voice message'}
      aria-pressed={isRecording}
      title={isRecording ? 'Stop recording' : 'Record a voice message'}
    >
      {isRecording ? (
        <span className="cw__mic-count" aria-hidden="true">
          {secondsLeft}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <rect
            x="9"
            y="3"
            width="6"
            height="11"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M5 11a7 7 0 0 0 14 0M12 18v3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
