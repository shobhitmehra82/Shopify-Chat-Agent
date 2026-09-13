import { callTool } from '../ucp/client.js'
import { extractMessages, UcpError } from '../ucp/errors.js'
import { withFormatted } from '../ucp/money.js'
import { catalogConfig } from '../config/catalog.config.js'
import { logger } from '../utils/logger.js'

/**
 * Cart tools.
 *
 * Five agent-facing actions over the four UCP cart operations:
 *
 *   add_to_cart       -> create_cart (first item) or update_cart
 *   update_cart_item  -> update_cart
 *   remove_from_cart  -> update_cart with quantity 0
 *   view_cart         -> get_cart
 *   clear_cart        -> cancel_cart
 *
 * The cart id lives on the session, never on the client — a client-supplied
 * cart id would be tamperable.
 *
 * READ-MODIFY-WRITE, and it is not optional. Verified against the live store:
 *
 *   - update_cart REPLACES the whole line_items array. Despite the schema's
 *     line_items[].id ("the ID of the line item to update"), sending just the
 *     changed line silently drops every other line from the cart.
 *   - Omitting a line is how you remove it. An empty array clears the cart.
 *   - quantity: 0 does NOT remove a line — it returns an error.
 *
 * So every mutation reads the cart, edits the full line list in memory, and
 * writes the whole list back.
 */

/* ------------------------------------------------------------------ actions */

export async function addToCart(input = {}, config = catalogConfig, session) {
  const variantId = requireVariantId(input.variant_id)
  const quantity = normaliseQuantity(input.quantity ?? 1, { min: 1 })

  let payload

  if (!session.cartId) {
    payload = await callTool('create_cart', {
      cart: {
        line_items: [{ item: { id: variantId }, quantity }],
        context: cartContext(config),
      },
    })
    session.cartId = payload.id
    logger.info('cart created', { sessionId: session.id, cartId: payload.id })
  } else {
    const lines = toLines(await readCart(session))
    const existing = lines.find((line) => line.variantId === variantId)

    if (existing) existing.quantity += quantity
    else lines.push({ variantId, quantity })

    payload = await writeLines(session, config, lines)
  }

  return present(payload, config, session, { action: 'add_to_cart', variantId })
}

export async function updateCartItem(input = {}, config = catalogConfig, session) {
  const quantity = normaliseQuantity(input.quantity, { min: 0 })
  const cart = await requireCart(session)
  const line = findLine(cart, {
    variantId: input.variant_id,
    lineItemId: input.line_item_id,
  })

  if (!line) return notInCart(cart, config, session)

  // Quantity 0 means remove. The API rejects a zero-quantity line, so the
  // removal is done by leaving it out of the array.
  if (quantity === 0) return removeLine(cart, line, config, session)

  const lines = toLines(cart)
  lines.find((candidate) => candidate.id === line.id).quantity = quantity

  const payload = await writeLines(session, config, lines)
  return present(payload, config, session, { action: 'update_cart_item' })
}

export async function removeFromCart(input = {}, config = catalogConfig, session) {
  const cart = await requireCart(session)
  const line = findLine(cart, {
    variantId: input.variant_id,
    lineItemId: input.line_item_id,
  })

  if (!line) return notInCart(cart, config, session)
  return removeLine(cart, line, config, session)
}

/**
 * Apply a discount code.
 *
 * Two things make this easy to get wrong:
 *
 *   - An invalid code is NOT an error. The store returns 200, echoes the code
 *     back in `discounts.codes`, leaves `applied` empty, and adds a warning.
 *     So success is decided by whether the code appears in `applied`, never by
 *     the call succeeding.
 *   - `codes` replaces the whole set, so an existing code must be re-sent or it
 *     is dropped.
 */
export async function applyDiscountCode(input = {}, config = catalogConfig, session) {
  const code = normaliseCode(input.code)
  const cart = await requireCart(session)

  const existing = currentCodes(cart)
  if (existing.some((entry) => entry.toUpperCase() === code.toUpperCase())) {
    const result = present(cart, config, session, { action: 'apply_discount_code', code })
    result.forModel.note = `${code} is already on the cart.`
    return result
  }

  const payload = await writeLines(session, config, toLines(cart), [...existing, code])
  const applied = appliedCodes(payload)
  const accepted = applied.some((entry) => entry.toUpperCase() === code.toUpperCase())

  // Rejected codes must not linger in `codes`, or the next apply re-submits
  // them and the buyer keeps seeing the same warning.
  let finalPayload = payload
  if (!accepted) {
    finalPayload = await writeLines(session, config, toLines(payload), existing)
  }

  const result = present(finalPayload, config, session, {
    action: 'apply_discount_code',
    code,
    accepted,
  })

  if (!accepted) {
    result.forModel.error =
      rejectionReason(payload, code) ||
      `${code} was not accepted. It may be expired, not valid for these items, or mistyped.`
  }
  return result
}

export async function removeDiscountCode(input = {}, config = catalogConfig, session) {
  const code = normaliseCode(input.code)
  const cart = await requireCart(session)

  const remaining = currentCodes(cart).filter(
    (entry) => entry.toUpperCase() !== code.toUpperCase(),
  )

  const payload = await writeLines(session, config, toLines(cart), remaining)
  return present(payload, config, session, { action: 'remove_discount_code', code })
}

export async function viewCart(input = {}, config = catalogConfig, session) {
  if (!session.cartId) return emptyCart(config)
  const payload = await readCart(session)
  return present(payload, config, session, { action: 'view_cart' })
}

export async function clearCart(input = {}, config = catalogConfig, session) {
  if (!session.cartId) return emptyCart(config)

  try {
    await callTool('cancel_cart', { id: session.cartId })
  } catch (error) {
    // An already-expired cart is not worth failing the turn over.
    logger.warn('cancel_cart failed', { code: error.code, message: error.message })
  }

  session.cartId = null
  return emptyCart(config, { action: 'clear_cart', cleared: true })
}

/* ------------------------------------------------------------------ helpers */

/**
 * Buyer context must go on EVERY cart write.
 *
 * Without it Shopify resolves the cart against no market, finds no inventory,
 * and rejects the line with `merchandise_out_of_stock` — even for items that
 * are plainly in stock and that create_checkout accepts. The error names the
 * wrong cause, so this is worth keeping in one place and never omitting.
 */
function cartContext(config) {
  return {
    address_country: config.locale.country,
    language: config.locale.language,
    currency: config.locale.currency,
  }
}

/** The cart's current lines, in the shape writeLines expects. */
function toLines(cart) {
  return (cart.line_items || []).map((line) => ({
    id: line.id,
    variantId: line.item?.id,
    quantity: line.quantity,
  }))
}

/**
 * Writes the complete desired line list. update_cart replaces the array, so
 * whatever is not in `lines` is removed — including everything, when empty.
 *
 * `codes` is optional: discount codes PERSIST across a line-item update, so
 * ordinary cart edits leave them alone by omitting the key. Pass an array only
 * when deliberately changing them (it replaces the whole set).
 */
function writeLines(session, config, lines, codes) {
  const cart = {
    line_items: lines
      .filter((line) => line.quantity > 0)
      .map((line) =>
        line.id
          ? { id: line.id, item: { id: line.variantId }, quantity: line.quantity }
          : { item: { id: line.variantId }, quantity: line.quantity },
      ),
    context: cartContext(config),
  }

  if (codes) cart.discounts = { codes }

  return callTool('update_cart', { id: session.cartId, cart })
}

async function removeLine(cart, line, config, session) {
  const remaining = toLines(cart).filter((candidate) => candidate.id !== line.id)
  const payload = await writeLines(session, config, remaining)

  return present(payload, config, session, {
    action: 'remove_from_cart',
    removed: line.item?.title || 'item',
  })
}

async function readCart(session) {
  try {
    return await callTool('get_cart', { id: session.cartId })
  } catch (error) {
    // Carts expire (~30 days) and can be cancelled out from under us. Drop the
    // stale id so the next add starts a fresh cart instead of looping on 404s.
    if (isMissingCart(error)) {
      logger.warn('cart no longer exists, dropping id', { cartId: session.cartId })
      session.cartId = null
      throw new UcpError('That cart is no longer available; it may have expired.', {
        code: 'cart_expired',
      })
    }
    throw error
  }
}

async function requireCart(session) {
  if (!session.cartId) {
    throw new UcpError('There is no cart yet.', { code: 'no_cart' })
  }
  return readCart(session)
}

function isMissingCart(error) {
  return (
    error?.code === 'not_found' ||
    error?.code === 'http_404' ||
    /not found|does not exist|invalid cart/i.test(error?.message || '')
  )
}

/** Matches a line by its line-item id, or by the variant it holds. */
function findLine(cart, { variantId, lineItemId }) {
  const lines = cart?.line_items || []
  if (lineItemId) {
    const byId = lines.find((line) => line.id === lineItemId)
    if (byId) return byId
  }
  if (variantId) {
    return lines.find((line) => line.item?.id === variantId)
  }
  return null
}

/* ----------------------------------------------------------------- discounts */

function normaliseCode(code) {
  if (typeof code !== 'string' || !code.trim()) {
    throw new UcpError('A discount code is required.', { code: 'bad_discount_code' })
  }
  return code.trim()
}

const currentCodes = (cart) => cart?.discounts?.codes || []

/** Codes that actually took effect. Automatic discounts have no `code`. */
const appliedCodes = (cart) =>
  (cart?.discounts?.applied || []).map((entry) => entry.code).filter(Boolean)

function rejectionReason(payload, code) {
  const message = (payload?.messages || []).find((entry) =>
    /discount/i.test(entry.code || entry.content || ''),
  )
  return message ? `${code}: ${message.content}` : null
}

/**
 * Normalises applied discounts for display. Automatic discounts (store-wide
 * promotions, "buy 2 get 1") arrive here too — they carry `automatic: true`
 * and no code, and the buyer never types anything to get them.
 */
function presentDiscounts(payload, currency) {
  const applied = (payload?.discounts?.applied || []).map((entry) => ({
    code: entry.code || null,
    title: entry.title || entry.code || 'Discount',
    automatic: Boolean(entry.automatic) || !entry.code,
    provisional: Boolean(entry.provisional),
    amount: withFormatted({ amount: entry.amount?.amount ?? entry.amount, currency }),
  }))

  const appliedSet = new Set(
    applied.map((entry) => (entry.code || '').toUpperCase()).filter(Boolean),
  )
  // Anything submitted that did not take effect.
  const rejected = currentCodes(payload).filter(
    (code) => !appliedSet.has(code.toUpperCase()),
  )

  return { applied, rejected, codes: currentCodes(payload) }
}

function requireVariantId(variantId) {
  if (typeof variantId !== 'string' || !variantId.includes('ProductVariant')) {
    throw new UcpError(
      'A product variant id is required. Search the catalogue first and use a variant id from the results.',
      { code: 'bad_variant_id' },
    )
  }
  return variantId
}

function normaliseQuantity(quantity, { min }) {
  const value = Number(quantity)
  if (!Number.isInteger(value) || value < min) {
    throw new UcpError(`Quantity must be a whole number of at least ${min}.`, {
      code: 'bad_quantity',
    })
  }
  return Math.min(value, 99)
}

async function notInCart(cart, config, session) {
  const result = present(cart, config, session, { action: 'not_found' })
  result.forModel.error =
    'That item is not in the cart. Call view_cart to see what is actually in it.'
  return result
}

/* -------------------------------------------------------------- presentation */

function emptyCart(config, meta = {}) {
  const display = cartDisplay(config)
  const noDiscounts = { applied: [], rejected: [], codes: [] }
  return {
    forModel: {
      ...meta,
      empty: true,
      item_count: 0,
      line_items: [],
      totals: [],
      discounts: { applied: [], rejected: [] },
    },
    forUi: {
      type: 'cart',
      cart: { empty: true, lineItems: [], totals: [], itemCount: 0, discounts: noDiscounts },
      display,
    },
  }
}

/**
 * Normalises a UCP cart into the shape the model and the widget consume.
 *
 * Cart money differs from catalogue money: line prices are bare integers in
 * minor units and the currency sits at the top of the cart, so it has to be
 * re-paired before formatting.
 */
function present(payload, config, session, meta = {}) {
  const display = cartDisplay(config)
  const currency = payload.currency || config.locale.currency
  const warnings = extractMessages(payload)

  const lineItems = (payload.line_items || []).map((line) => {
    const unitAmount = line.item?.price
    const lineTotal = pickTotal(line.totals, 'total') ?? pickTotal(line.totals, 'subtotal')

    return {
      id: line.id,
      variantId: line.item?.id,
      title: line.item?.title || 'Item',
      quantity: line.quantity,
      image: line.item?.image_url || null,
      unitPrice: withFormatted({ amount: unitAmount, currency }),
      lineTotal: withFormatted({ amount: lineTotal, currency }),
    }
  })

  const totals = (payload.totals || []).map((total) => ({
    type: total.type,
    label: total.display_text || labelFor(total.type),
    ...withFormatted({ amount: total.amount, currency }),
  }))

  const itemCount = lineItems.reduce((sum, line) => sum + (line.quantity || 0), 0)
  const empty = lineItems.length === 0
  const discounts = presentDiscounts(payload, currency)

  const cart = {
    id: payload.id,
    currency,
    empty,
    itemCount,
    lineItems,
    totals,
    discounts,
    subtotal: totals.find((total) => total.type === 'subtotal') || null,
    total: totals.find((total) => total.type === 'total') || null,
    checkoutUrl: payload.continue_url || null,
    expiresAt: payload.expires_at || null,
  }

  return {
    forModel: {
      ...meta,
      empty,
      item_count: itemCount,
      currency,
      line_items: lineItems.map((line) => ({
        line_item_id: line.id,
        variant_id: line.variantId,
        title: line.title,
        quantity: line.quantity,
        unit_price: line.unitPrice?.formatted,
        line_total: line.lineTotal?.formatted,
      })),
      totals: totals.map((total) => `${total.label}: ${total.formatted}`),
      discounts: {
        // `automatic: true` entries need no code — the store applied them.
        applied: discounts.applied.map((entry) => ({
          title: entry.title,
          code: entry.code,
          automatic: entry.automatic,
          amount: entry.amount?.formatted,
        })),
        rejected: discounts.rejected,
      },
      warnings,
      display_note: display.cartCard
        ? 'The cart is rendered as a card in the UI. Confirm the change in one short sentence; do not re-list every line and price.'
        : 'There is no cart card in the UI. List the cart contents and totals in your text.',
    },
    forUi: { type: 'cart', cart, display },
  }
}

function cartDisplay(config) {
  return {
    cartCard: config.display.cartCard,
    checkoutButton: config.display.checkoutButton,
    discounts: config.display.discounts,
  }
}

function pickTotal(totals, type) {
  return (totals || []).find((total) => total.type === type)?.amount
}

function labelFor(type) {
  return (
    { subtotal: 'Subtotal', total: 'Total', fulfillment: 'Shipping', tax: 'Tax' }[type] ||
    type
  )
}
