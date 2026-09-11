import { callTool } from '../ucp/client.js'
import { extractMessages } from '../ucp/errors.js'
import { majorToMinor, withFormatted } from '../ucp/money.js'
import { catalogConfig, SORT_OPTIONS } from '../config/catalog.config.js'
import { logger } from '../utils/logger.js'

/**
 * search_catalog.
 *
 * UCP supports only query / categories / price / available / pagination. Colour,
 * size and sorting are ours, applied to the fetched candidate set — see
 * src/config/catalog.config.js for what that implies.
 */
export async function searchCatalog(input = {}, config = catalogConfig) {
  const { search, display, fetch: fetchConfig, locale } = config

  const limit = clampLimit(input.limit, search.resultLimit)
  const color = normalise(input.color)
  const size = normalise(input.size)

  // Colour and size have no API filter, and any sort other than the store's own
  // order is a re-sort. Both only see what we fetched, so widen the net.
  const needsPostProcessing =
    Boolean(color) || Boolean(size) || search.sort !== SORT_OPTIONS.BESTSELLER

  const pageSize = needsPostProcessing ? fetchConfig.pageSize : limit
  const maxPages = needsPostProcessing ? fetchConfig.maxPages : 1

  const request = buildRequest({ input, color, pageSize, search, locale })

  const { products, pagination, warnings } = await fetchPages({
    request,
    maxPages,
    cursor: input.cursor,
  })

  let candidates = products

  // filters.available is accurate (verified: 20/20 variants it reported as
  // available were accepted by the cart), but stock can move between the search
  // and the buyer acting on it, so the variant-level check is cheap insurance.
  if (search.availableOnly) {
    candidates = candidates.filter(hasAvailableVariant)
  }
  if (color) {
    candidates = candidates.filter((product) => matchesColor(product, color))
  }
  if (size) {
    candidates = candidates.filter((product) => matchesSize(product, size))
  }

  const sorted = sortProducts(candidates, search.sort)
  const page = sorted.slice(0, limit)

  logger.info('catalog search', {
    query: input.query || null,
    color: color || null,
    size: size || null,
    fetched: products.length,
    afterFilters: candidates.length,
    returned: page.length,
    sort: search.sort,
  })

  const cards = page.map((product) => toProductCard(product, config))

  return {
    // Compact payload for Claude — no image URLs, no HTML, capped variants.
    forModel: {
      products: cards.map(stripForModel),
      returned: cards.length,
      matched_before_limit: candidates.length,
      sort: search.sort,
      available_only: search.availableOnly,
      filters_applied: {
        query: input.query || null,
        color: color || null,
        size: size || null,
        price_min: input.price_min ?? null,
        price_max: input.price_max ?? null,
        categories: input.categories || null,
      },
      has_more: Boolean(pagination?.has_next_page),
      next_cursor: pagination?.cursor || null,
      warnings,
      display_note: display.productCard
        ? 'Product cards are rendered separately in the UI. Summarise briefly; do not list every product, price and variant in prose.'
        : 'Product cards are disabled. Describe the results in prose, including prices.',
    },
    // Rich payload for the widget.
    forUi: {
      type: 'products',
      products: cards,
      display: { ...display },
      hasMore: Boolean(pagination?.has_next_page),
      cursor: pagination?.cursor || null,
    },
  }
}

function buildRequest({ input, color, pageSize, search, locale }) {
  // Colour has no filter, so fold it into the text query too — Shopify's search
  // is semantic and "blue shirt" outranks a bare "shirt". Size is left out on
  // purpose: it pollutes relevance without helping.
  const query = [input.query, color].filter(Boolean).join(' ').trim()

  const filters = { available: search.availableOnly }

  const currency = locale.currency
  const priceMin = majorToMinor(input.price_min, currency)
  const priceMax = majorToMinor(input.price_max, currency)
  if (priceMin != null || priceMax != null) {
    filters.price = {}
    if (priceMin != null) filters.price.min = priceMin
    if (priceMax != null) filters.price.max = priceMax
  }

  if (Array.isArray(input.categories) && input.categories.length > 0) {
    filters.categories = input.categories
  }

  const catalog = {
    filters,
    pagination: { limit: pageSize },
    context: {
      address_country: locale.country,
      language: locale.language,
      currency,
    },
  }

  // UCP requires at least one of query or filters; filters is always present,
  // but an empty query is still worth omitting.
  if (query) catalog.query = query

  return catalog
}

async function fetchPages({ request, maxPages, cursor }) {
  const products = []
  const warnings = []
  let pagination = null
  let nextCursor = cursor || null

  for (let page = 0; page < maxPages; page++) {
    const catalog = { ...request }
    if (nextCursor) {
      catalog.pagination = { ...request.pagination, cursor: nextCursor }
    }

    const payload = await callTool('search_catalog', { catalog })

    warnings.push(...extractMessages(payload))
    products.push(...(payload.products || []))
    pagination = payload.pagination || null

    nextCursor = pagination?.has_next_page ? pagination.cursor : null
    if (!nextCursor) break
  }

  return { products, pagination, warnings }
}

/* ---------------------------------------------------------------- filtering */

function normalise(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

function hasAvailableVariant(product) {
  return (product.variants || []).some((variant) => variant.availability?.available)
}

/**
 * Variant options look like [{ name: "Size", label: "Small" }]. Option names are
 * merchant-defined, so the name is matched loosely.
 */
function optionLabels(product, optionName) {
  const labels = []
  for (const variant of product.variants || []) {
    for (const option of variant.options || []) {
      if ((option.name || '').toLowerCase().includes(optionName)) {
        labels.push((option.label || '').toLowerCase())
      }
    }
  }
  return labels
}

/** "blue" should hit "Blue Linen" and "Sky Blue". */
function matchesColor(product, wanted) {
  return optionLabels(product, 'color').some(
    (label) => label === wanted || label.includes(wanted),
  )
}

/**
 * Sizes are written both ways — a buyer says "S", the store says "Small". Match
 * across the alias set rather than on the literal string, and never substring
 * match a short code ("s" would otherwise hit every label containing an s).
 */
const SIZE_ALIASES = [
  ['xxs', 'xx-small', '2xs'],
  ['xs', 'x-small', 'extra small'],
  ['s', 'small'],
  ['m', 'medium', 'med'],
  ['l', 'large'],
  ['xl', 'x-large', 'xlarge', 'extra large'],
  ['xxl', 'xx-large', '2xl', '2x-large'],
  ['xxxl', 'xxx-large', '3xl', '3x-large'],
]

function sizeAliases(wanted) {
  const group = SIZE_ALIASES.find((aliases) => aliases.includes(wanted))
  return new Set(group || [wanted])
}

function matchesSize(product, wanted) {
  const aliases = sizeAliases(wanted)

  return optionLabels(product, 'size').some((label) => {
    if (aliases.has(label)) return true
    // Labels like "Small / Petite" — check each word.
    const words = label.split(/[\s/,-]+/).filter(Boolean)
    if (words.some((word) => aliases.has(word))) return true
    // Numeric or free-form sizes ("32", "One Size") have no alias group.
    return wanted.length > 2 && label.includes(wanted)
  })
}

/* ------------------------------------------------------------------ sorting */

function sortProducts(products, sort) {
  const sorted = [...products]

  switch (sort) {
    case SORT_OPTIONS.PRICE_LOW_TO_HIGH:
      return sorted.sort((a, b) => minPrice(a) - minPrice(b))
    case SORT_OPTIONS.PRICE_HIGH_TO_LOW:
      return sorted.sort((a, b) => minPrice(b) - minPrice(a))
    case SORT_OPTIONS.TITLE_A_Z:
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case SORT_OPTIONS.TITLE_Z_A:
      return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
    case SORT_OPTIONS.BESTSELLER:
    default:
      // Shopify's own ordering. UCP exposes no sales rank, so the honest thing
      // is to leave the order untouched rather than invent a ranking.
      return sorted
  }
}

function minPrice(product) {
  const range = product.price_range?.min?.amount
  if (typeof range === 'number') return range

  const prices = (product.variants || [])
    .map((variant) => variant.price?.amount)
    .filter((amount) => typeof amount === 'number')

  return prices.length > 0 ? Math.min(...prices) : Number.POSITIVE_INFINITY
}

/* -------------------------------------------------------------- normalising */

function toProductCard(product, config) {
  const { search, locale } = config
  const currency = product.price_range?.min?.currency || locale.currency

  const variants = (product.variants || [])
    .slice(0, search.maxVariantsPerProduct)
    .map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku || null,
      price: withFormatted(variant.price),
      available: Boolean(variant.availability?.available),
      options: (variant.options || []).map((option) => ({
        name: option.name,
        label: option.label,
      })),
      image: variant.media?.[0]?.url || null,
    }))

  const priceRange = {
    min: withFormatted(product.price_range?.min),
    max: withFormatted(product.price_range?.max),
  }

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: toPlainText(product.description?.html, search.descriptionLength),
    currency,
    price: priceRange.min,
    priceRange,
    priceVaries: priceRange.min?.amount !== priceRange.max?.amount,
    image: firstImage(product),
    available: variants.some((variant) => variant.available),
    variantCount: (product.variants || []).length,
    variants,
    url: product.handle ? `https://${storeHost()}/products/${product.handle}` : null,
  }
}

/** Trims the card down to what Claude actually needs to reason and answer. */
function stripForModel(card) {
  return {
    id: card.id,
    title: card.title,
    price: card.price?.formatted,
    price_varies: card.priceVaries,
    price_max: card.priceVaries ? card.priceRange.max?.formatted : undefined,
    available: card.available,
    description: card.description,
    variants: card.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      available: variant.available,
      options: variant.options.map((option) => `${option.name}: ${option.label}`),
    })),
  }
}

function firstImage(product) {
  for (const variant of product.variants || []) {
    const url = variant.media?.[0]?.url
    if (url) return url
  }
  return null
}

function toPlainText(html, maxLength) {
  if (!html || !maxLength) return null
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text
}

function storeHost() {
  return process.env.SHOPIFY_STORE_DOMAIN || 'agentic-training.myshopify.com'
}

function clampLimit(requested, fallback) {
  if (!Number.isInteger(requested) || requested < 1) return fallback
  // A buyer asking for "20 shirts" should not be able to blow up the response.
  return Math.min(requested, 24)
}
