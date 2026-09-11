export default function TypingIndicator() {
  return (
    <div className="cw__row cw__row--assistant">
      <div className="cw__bubble cw__bubble--assistant cw__typing">
        <span className="cw__dot" />
        <span className="cw__dot" />
        <span className="cw__dot" />
        <span className="cw__sr-only">Assistant is typing</span>
      </div>
    </div>
  )
}
