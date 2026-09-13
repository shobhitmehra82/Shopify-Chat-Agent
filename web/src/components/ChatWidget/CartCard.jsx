/**
 * Renders a `cart` attachment.
 *
 * Read-only by design: the cart is changed by talking to the agent, so there is
 * exactly one path that mutates it. Quantity is shown, not edited.
 */
export default function CartCard({ attachment }) {
  const { cart, display = {} } = attachment

  if (!display.cartCard) return null

  if (cart.empty) {
    return (
      <div className="cw-cart cw-cart--empty">
        <p className="cw-cart__empty-text">Your cart is empty.</p>
      </div>
    )
  }

  return (
    <section className="cw-cart" aria-label="Cart">
      <header className="cw-cart__header">
        <span className="cw-cart__title">Cart</span>
        <span className="cw-cart__count">
          {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
        </span>
      </header>

      <ul className="cw-cart__lines">
        {cart.lineItems.map((line) => (
          <li key={line.id} className="cw-cart__line">
            <div className="cw-cart__thumb">
              {line.image ? (
                <img src={line.image} alt={line.title} loading="lazy" />
              ) : (
                <div className="cw-cart__thumb-empty" aria-hidden="true" />
              )}
            </div>

            <div className="cw-cart__line-body">
              <p className="cw-cart__line-title" title={line.title}>
                {line.title}
              </p>
              <p className="cw-cart__line-meta">
                Qty {line.quantity}
                {line.unitPrice?.formatted && ` · ${line.unitPrice.formatted} each`}
              </p>
            </div>

            <span className="cw-cart__line-total">
              {line.lineTotal?.formatted || line.unitPrice?.formatted}
            </span>
          </li>
        ))}
      </ul>

      {display.discounts && cart.discounts?.applied?.length > 0 && (
        <ul className="cw-cart__discounts">
          {cart.discounts.applied.map((discount, index) => (
            <li key={index} className="cw-cart__discount">
              <span className="cw-cart__discount-tag">
                {discount.automatic ? 'Automatic' : discount.code}
              </span>
              <span className="cw-cart__discount-title">{discount.title}</span>
              {discount.amount?.formatted && (
                <span className="cw-cart__discount-amount">
                  −{discount.amount.formatted}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {display.discounts && cart.discounts?.rejected?.length > 0 && (
        <p className="cw-cart__discount-rejected">
          Not applied: {cart.discounts.rejected.join(', ')}
        </p>
      )}

      <dl className="cw-cart__totals">
        {cart.totals.map((total) => (
          <div
            key={total.type}
            className={`cw-cart__total-row ${
              total.type === 'total' ? 'cw-cart__total-row--grand' : ''
            }`}
          >
            <dt>{total.label}</dt>
            <dd>{total.formatted}</dd>
          </div>
        ))}
      </dl>

      {display.checkoutButton && cart.checkoutUrl && (
        <a
          className="cw-cart__checkout"
          href={cart.checkoutUrl}
          target="_blank"
          rel="noreferrer"
        >
          Checkout
        </a>
      )}
    </section>
  )
}
