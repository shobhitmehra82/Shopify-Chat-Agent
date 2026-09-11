import { useRef } from 'react'
import ProductCard from './ProductCard.jsx'

/**
 * The Add to cart button goes through the agent rather than a separate cart
 * endpoint, so there is one path that mutates the cart. The variant id is
 * included so the agent never has to guess which option was picked.
 */
function addToCartPhrase(product, variant) {
  const name = variant?.title ? `${product.title} — ${variant.title}` : product.title
  return `Add "${name}" to my cart (variant ${variant?.id || product.variants?.[0]?.id})`
}

/**
 * Renders a `products` attachment from the agent.
 *
 * Layout is driven by the server's catalog.config.js — the widget does not
 * decide. display.productCard=false means the agent described the results in
 * text and there is nothing to render here.
 */
export default function ProductResults({ attachment, onAction }) {
  const { products = [], display = {} } = attachment
  const trackRef = useRef(null)

  if (!display.productCard || products.length === 0) return null

  const isCarousel = display.carousel && products.length > 1

  function scrollBy(direction) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className={`cw-results ${isCarousel ? 'cw-results--carousel' : 'cw-results--list'}`}>
      <div className="cw-results__track" ref={trackRef}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showVariants={display.variants}
            onAddToCart={onAction && ((item, variant) => onAction(addToCartPhrase(item, variant)))}
          />
        ))}
      </div>

      {isCarousel && (
        <div className="cw-results__nav">
          <button
            type="button"
            className="cw-results__arrow"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll to previous products"
          >
            ‹
          </button>
          <button
            type="button"
            className="cw-results__arrow"
            onClick={() => scrollBy(1)}
            aria-label="Scroll to more products"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
