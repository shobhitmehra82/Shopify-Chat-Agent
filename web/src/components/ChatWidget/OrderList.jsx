/** Payment status -> tone. Anything unlisted falls back to neutral. */
const FINANCIAL_TONE = {
  PAID: 'ok',
  PARTIALLY_PAID: 'warn',
  PENDING: 'warn',
  AUTHORIZED: 'warn',
  REFUNDED: 'muted',
  PARTIALLY_REFUNDED: 'muted',
  VOIDED: 'muted',
}

const FULFILMENT_TONE = {
  FULFILLED: 'ok',
  IN_PROGRESS: 'warn',
  PARTIALLY_FULFILLED: 'warn',
  PENDING_FULFILLMENT: 'warn',
  SCHEDULED: 'warn',
  ON_HOLD: 'warn',
  UNFULFILLED: 'muted',
  RESTOCKED: 'muted',
}

function formatDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export default function OrderList({ attachment }) {
  const { orders = [], display = {} } = attachment

  if (!display.orderCard) return null

  if (orders.length === 0) {
    return (
      <div className="cw-orders cw-orders--empty">
        <p>No orders on this account yet.</p>
      </div>
    )
  }

  return (
    <div className="cw-orders">
      {orders.map((order) => (
        <article key={order.id} className="cw-order">
          <header className="cw-order__head">
            <span className="cw-order__name">{order.name}</span>
            <span className="cw-order__date">{formatDate(order.processedAt)}</span>
          </header>

          <div className="cw-order__badges">
            <span
              className={`cw-badge cw-badge--${FINANCIAL_TONE[order.financialStatus] || 'muted'}`}
            >
              {order.financialStatusLabel}
            </span>
            <span
              className={`cw-badge cw-badge--${FULFILMENT_TONE[order.fulfillmentStatus] || 'muted'}`}
            >
              {order.fulfillmentStatusLabel}
            </span>
            {order.cancelledAt && <span className="cw-badge cw-badge--bad">Cancelled</span>}
            {order.total && <span className="cw-order__total">{order.total.formatted}</span>}
          </div>

          {display.showLineItems && order.lineItems.length > 0 && (
            <ul className="cw-order__items">
              {order.lineItems.map((item, index) => (
                <li key={index}>
                  {item.quantity}× {item.title}
                  {item.variantTitle &&
                    item.variantTitle !== 'Default Title' &&
                    ` (${item.variantTitle})`}
                </li>
              ))}
            </ul>
          )}

          {order.tracking.length > 0 && (
            <p className="cw-order__tracking">
              {order.tracking.map((entry, index) => (
                <span key={index}>
                  {entry.company ? `${entry.company}: ` : 'Tracking: '}
                  {entry.url ? (
                    <a href={entry.url} target="_blank" rel="noreferrer">
                      {entry.number || 'track'}
                    </a>
                  ) : (
                    entry.number
                  )}
                </span>
              ))}
            </p>
          )}

          {display.statusLink && order.statusUrl && (
            <a
              className="cw-order__link"
              href={order.statusUrl}
              target="_blank"
              rel="noreferrer"
            >
              View order status
            </a>
          )}
        </article>
      ))}
    </div>
  )
}
