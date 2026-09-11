/**
 * Chatbot configuration — catalogue search, and how results and the cart are
 * displayed.
 *
 * This is the file to edit to change chatbot behaviour. Everything here is
 * read at request time, so `npm run dev` picks up edits on restart.
 *
 * IMPORTANT — what Shopify's UCP API can and cannot do:
 *
 *   The endpoint accepts ONLY these search parameters:
 *       query, filters.categories, filters.price, filters.available, pagination
 *
 *   It has NO sort parameter and NO colour/size/vendor/tag filters. So:
 *     - `sort`          is applied by us, after fetching (see notes on SORT_OPTIONS)
 *     - colour / size   are applied by us, by matching variant options[]
 *
 *   That means sorting and colour/size filtering operate on the candidate set we
 *   fetched, not on the whole catalogue. `fetch.maxPages` controls how deep we
 *   look before sorting.
 */

/**
 * Sorting options for `search.sort`.
 *
 * NOTE ON "bestseller": UCP returns no sales-rank or popularity field, so true
 * best-seller ordering is not available. `bestseller` therefore means "leave
 * Shopify's own ordering alone" — which for a search is its relevance ranking,
 * and for an unfiltered browse is the storefront's default product order (which
 * Shopify merchants commonly set to best-selling). It is the most sensible
 * default, but it is not a guaranteed sales ranking.
 */
export const SORT_OPTIONS = {
  BESTSELLER: 'bestseller',
  PRICE_LOW_TO_HIGH: 'price_low_to_high',
  PRICE_HIGH_TO_LOW: 'price_high_to_low',
  TITLE_A_Z: 'title_a_z',
  TITLE_Z_A: 'title_z_a',
}

export const catalogConfig = {
  search: {
    /**
     * 1. Sorting. One of SORT_OPTIONS. Default: bestseller (Shopify's own order).
     *    Anything other than `bestseller` is a re-sort of the fetched candidates.
     */
    sort: SORT_OPTIONS.BESTSELLER,

    /**
     * 2. Show only products that can actually be bought. Default: true.
     *    Sent to Shopify as filters.available, and re-checked against variant
     *    availability here in case stock changes between search and display.
     */
    availableOnly: true,

    /**
     * 3. How many products to show in one answer. Default: 6.
     */
    resultLimit: 6,

    /**
     * Cap on variants sent back per product (keeps token cost and card size sane).
     */
    maxVariantsPerProduct: 12,

    /**
     * Description length in the product card, in characters. 0 disables it.
     */
    descriptionLength: 180,
  },

  display: {
    /**
     * 4. Render results as product cards. Default: true.
     *    false = the agent describes results in plain text only.
     */
    productCard: true,

    /**
     * 5. Lay the cards out as a horizontal carousel. Default: true.
     *    false = vertical stacked list.
     */
    carousel: true,

    /**
     * 6. Show variant options and the Add to cart control on each card.
     *    Default: true.
     */
    variants: true,

    /**
     * 7. Render the cart as a structured card — line items with thumbnail,
     *    quantity, unit price, line total, and the subtotal/total rows.
     *    Default: true. false = the agent lists the cart in plain text.
     */
    cartCard: true,

    /**
     * 8. Show the checkout button on the cart card. Default: true.
     *    Links to Shopify's hosted checkout (the cart's continue_url) until the
     *    in-chat checkout flow is built.
     */
    checkoutButton: true,
  },

  /**
   * Over-fetching. Sorting and colour/size filtering can only see what we fetched,
   * so we pull more than we show when a re-sort or a post-filter is in play.
   * With the default sort and no colour/size, we fetch exactly `resultLimit`.
   */
  fetch: {
    pageSize: 20,
    maxPages: 2,
  },

  /**
   * Buyer context sent to Shopify. Currency drives which currency prices come
   * back in; a shipping address later in checkout overrides it.
   */
  locale: {
    country: 'US',
    language: 'en',
    currency: 'USD',
  },
}

const VALID_SORTS = new Set(Object.values(SORT_OPTIONS))

/**
 * Fails fast on a bad edit rather than silently ignoring it.
 */
export function validateCatalogConfig(config = catalogConfig) {
  const errors = []
  const { search, display, fetch } = config

  if (!VALID_SORTS.has(search.sort)) {
    errors.push(
      `search.sort "${search.sort}" is not valid. Use one of: ${[...VALID_SORTS].join(', ')}`,
    )
  }
  if (!Number.isInteger(search.resultLimit) || search.resultLimit < 1) {
    errors.push('search.resultLimit must be an integer >= 1')
  }
  if (!Number.isInteger(fetch.pageSize) || fetch.pageSize < 1) {
    errors.push('fetch.pageSize must be an integer >= 1')
  }
  if (!Number.isInteger(fetch.maxPages) || fetch.maxPages < 1) {
    errors.push('fetch.maxPages must be an integer >= 1')
  }
  for (const key of ['productCard', 'carousel', 'variants', 'cartCard', 'checkoutButton']) {
    if (typeof display[key] !== 'boolean') {
      errors.push(`display.${key} must be true or false`)
    }
  }
  if (typeof search.availableOnly !== 'boolean') {
    errors.push('search.availableOnly must be true or false')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid catalog.config.js:\n  - ${errors.join('\n  - ')}`)
  }
  return config
}
