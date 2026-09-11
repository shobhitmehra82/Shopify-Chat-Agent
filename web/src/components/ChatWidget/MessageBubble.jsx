import ProductResults from './ProductResults.jsx'
import CartCard from './CartCard.jsx'

const RENDERERS = {
  products: ProductResults,
  cart: CartCard,
}

export default function MessageBubble({ message, onAction }) {
  const { role, content, attachments = [] } = message

  if (role === 'system') {
    return <p className="cw__system-note">{content}</p>
  }

  return (
    <>
      {content && (
        <div className={`cw__row cw__row--${role}`}>
          <div className={`cw__bubble cw__bubble--${role}`}>{content}</div>
        </div>
      )}

      {attachments.map((attachment, index) => {
        const Renderer = RENDERERS[attachment.type]
        return Renderer ? (
          <Renderer key={index} attachment={attachment} onAction={onAction} />
        ) : null
      })}
    </>
  )
}
