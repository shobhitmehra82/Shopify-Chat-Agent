import { useState } from 'react'

export default function ProductCard({ product, showVariants, onAddToCart }) {
  const variants = product.variants || []
  const [selectedId, setSelectedId] = useState(
    variants.find((variant) => variant.available)?.id || variants[0]?.id || '',
  )

  const selected = variants.find((variant) => variant.id === selectedId)
  const price = selected?.price?.formatted || product.price?.formatted

  return (
    <article className="cw-card">
      <div className="cw-card__media">
        {product.image ? (
          <img src={product.image} alt={product.title} loading="lazy" />
        ) : (
          <div className="cw-card__media-empty" aria-hidden="true" />
        )}
        {!product.available && <span className="cw-card__badge">Sold out</span>}
      </div>

      <div className="cw-card__body">
        <h4 className="cw-card__title" title={product.title}>
          {product.url ? (
            <a href={product.url} target="_blank" rel="noreferrer">
              {product.title}
            </a>
          ) : (
            product.title
          )}
        </h4>

        <p className="cw-card__price">
          {price}
          {!selected && product.priceVaries && product.priceRange?.max && (
            <span className="cw-card__price-range">
              {' '}
              – {product.priceRange.max.formatted}
            </span>
          )}
        </p>

        {showVariants && variants.length > 0 && (
          <>
            {variants.length > 1 && (
              <select
                className="cw-card__variants"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                aria-label={`Choose an option for ${product.title}`}
              >
                {variants.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                    disabled={!variant.available}
                  >
                    {variant.title}
                    {variant.available ? '' : ' — sold out'}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="cw-card__add"
              disabled={!selected?.available || !onAddToCart}
              onClick={() => onAddToCart?.(product, selected)}
            >
              {selected?.available === false ? 'Sold out' : 'Add to cart'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
