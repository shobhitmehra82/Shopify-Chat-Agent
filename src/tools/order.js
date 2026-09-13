import { callTool } from '../ucp/client.js'
import { extractMessages, UcpError } from '../ucp/errors.js'
import { fetchOrders, CustomerAccountError } from '../shopify/customerAccount.js'
import { catalogConfig } from '../config/catalog.config.js'
import { logger } from '../utils/logger.js'

/**
 * Order tracking.
 *
 * Two sources, because neither alone is enough:
 *
 *   list_orders  -> Customer Account API, for the signed-in buyer's own order
 *                   history. UCP cannot do this: get_order takes a single order
 *                   id and the order capability defines no list or search.
 *   track_order  -> UCP get_order, for the live state of one specific order.
 *
 * Nothing is returned until the buyer has signed in. The session holds the
 * customer access token; the model never sees it and never handles identity.
 */

/** Orders arrive from Shopify already sorted PROCESSED_AT desc. */
export async function listOrders(input = {}, config = catalogConfig, session) {
  if (!session.customerToken) return authRequired(config)

  let result
  try {
    result = await fetchOrders(session.customerToken, {
      limit: clampLimit(input.limit, config.orders.historyLimit),
    })
  } catch (error) {
    if (error instanceof CustomerAccountError && error.code === 'unauthorized') {
      clearCustomer(session)
      return authRequired(config, 'Your session expired, so please sign in again.')
    }
    throw error
  }

  session.customerEmail = result.customer.email

  const orders = result.orders.map((order) => toOrderCard(order))
  logger.info('listed orders', { count: orders.length })

  return present(orders, result.customer, config, { action: 'list_orders' })
}

/**
 * Live detail for one order via UCP get_order, with the Customer Account
 * record as the fallback. The order must belong to the signed-in customer — the id is
 * matched against their own order list rather than trusted from the model.
 */
export async function trackOrder(input = {}, config = catalogConfig, session) {
  if (!session.customerToken) return authRequired(config)

  const { orders: theirOrders, customer } = await fetchOrders(session.customerToken, {
    limit: Math.max(config.orders.historyLimit, 25),
  })

  const wanted = String(input.order_id || input.order_name || '').trim()
  const match = theirOrders.find(
    (order) =>
      order.id === wanted ||
      normaliseId(order.id) === normaliseId(wanted) ||
      order.name?.toLowerCase() === wanted.toLowerCase() ||
      order.name?.toLowerCase() === `#${wanted.toLowerCase()}` ||
      String(order.orderNumber) === wanted.replace(/^#/, ''),
  )

  if (!match) {
    return {
      forModel: {
        action: 'track_order',
        error: `No order matching "${wanted}" on this account. Call list_orders to see what is there.`,
      },
      forUi: null,
    }
  }

  const card = toOrderCard(match)

  // Enrich with the live UCP view. Best-effort: the Customer Account record
  // is already accurate, so a UCP failure must not lose the order.
  try {
    const payload = await callTool('get_order', { id: normaliseId(match.id) })
    card.live = summariseUcpOrder(payload)
    card.warnings = extractMessages(payload)
  } catch (error) {
    logger.warn('ucp get_order failed, using customer account record', {
      code: error instanceof UcpError ? error.code : 'unknown',
      message: error.message,
    })
    card.live = null
  }

  return present([card], customer, config, { action: 'track_order' })
}

/* ------------------------------------------------------------------ helpers */

function authRequired(config, reason) {
  return {
    forModel: {
      authenticated: false,
      error:
        reason ||
        'The buyer is not signed in. A sign-in panel has been shown to them. Ask them to sign in with their store account, then try again. Do NOT ask for their password yourself.',
    },
    forUi: { type: 'auth_required', reason: reason || null },
  }
}

function clearCustomer(session) {
  session.customerToken = null
  session.customerRefreshToken = null
  session.customerTokenExpiresAt = null
  session.customerEmail = null
}

/**
 * UCP order ids have no query string; customer-facing ids can carry one
 * (gid://shopify/Order/123?key=abc).
 */
function normaliseId(id) {
  return String(id || '').split('?')[0]
}

function clampLimit(requested, fallback) {
  if (!Number.isInteger(requested) || requested < 1) return fallback
  return Math.min(requested, 50)
}

const TITLE_CASE = (value) =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : null

function toOrderCard(order) {
  const money = order.currentTotalPrice || order.totalPrice
  const tracking = (order.successfulFulfillments || []).flatMap((fulfillment) =>
    (fulfillment.trackingInfo || []).map((info) => ({
      company: fulfillment.trackingCompany || null,
      number: info.number || null,
      url: info.url || null,
    })),
  )

  return {
    id: order.id,
    name: order.name,
    orderNumber: order.orderNumber,
    processedAt: order.processedAt,
    // Shopify returns these as enums; the UI shows the readable form.
    financialStatus: order.financialStatus || null,
    financialStatusLabel: TITLE_CASE(order.financialStatus) || 'Unknown',
    fulfillmentStatus: order.fulfillmentStatus || null,
    fulfillmentStatusLabel: TITLE_CASE(order.fulfillmentStatus) || 'Unfulfilled',
    cancelledAt: order.canceledAt || null,
    cancelReason: TITLE_CASE(order.cancelReason),
    total: money
      ? { amount: money.amount, currency: money.currencyCode, formatted: formatAmount(money) }
      : null,
    statusUrl: order.statusUrl || null,
    shipTo: order.shippingAddress
      ? [
          order.shippingAddress.city,
          order.shippingAddress.province,
          order.shippingAddress.countryCodeV2,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
    tracking,
    lineItems: (order.lineItems?.edges || []).map((edge) => ({
      title: edge.node.title,
      quantity: edge.node.quantity,
      variantTitle: edge.node.variant?.title || null,
      image: edge.node.variant?.image?.url || null,
    })),
  }
}

/**
 * Customer Account money is a decimal STRING in major units ("152.60") —
 * unlike UCP's integer minor units. Do not run it through ucp/money.js.
 */
function formatAmount({ amount, currencyCode }) {
  const value = Number(amount)
  if (Number.isNaN(value)) return null
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
    }).format(value)
  } catch {
    return `${amount} ${currencyCode}`
  }
}

function summariseUcpOrder(payload) {
  if (!payload) return null
  return {
    id: payload.id,
    status: payload.status || null,
    totals: (payload.totals || []).map((total) => ({
      type: total.type,
      label: total.display_text || total.type,
      amount: total.amount,
    })),
  }
}

function present(orders, customer, config, meta) {
  const { orders: orderConfig } = config

  return {
    forModel: {
      ...meta,
      authenticated: true,
      customer_email: customer?.email || null,
      count: orders.length,
      sorted_by: 'date, newest first',
      orders: orders.map((order) => ({
        name: order.name,
        placed: order.processedAt,
        financial_status: order.financialStatusLabel,
        fulfillment_status: order.fulfillmentStatusLabel,
        total: order.total?.formatted,
        cancelled: Boolean(order.cancelledAt),
        tracking: order.tracking.map((entry) => entry.number).filter(Boolean),
        items: order.lineItems.map((item) => `${item.quantity}x ${item.title}`),
        live_status: order.live?.status,
      })),
      display_note: orderConfig.orderCard
        ? 'Orders are rendered as cards in the UI. Summarise in a sentence; do not re-list every order and status.'
        : 'There are no order cards. List each order with its number, date, payment status and fulfilment status.',
    },
    forUi: {
      type: 'orders',
      orders,
      customer,
      display: { ...orderConfig },
    },
  }
}
