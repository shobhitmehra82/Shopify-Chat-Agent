import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

/**
 * Shopify Customer Account API — the signed-in buyer's own data.
 *
 * Distinct from UCP (no auth, single order by id) and from the Admin API
 * (needs read_orders and would expose every customer). This API is scoped to
 * whoever holds the token, which is what makes order history safe to expose.
 */

export class CustomerAccountError extends Error {
  constructor(message, { code } = {}) {
    super(message)
    this.name = 'CustomerAccountError'
    this.code = code
  }
}

let endpointCache = null

/** The GraphQL endpoint is published by the store, so it is not hardcoded. */
async function endpoint() {
  if (endpointCache) return endpointCache
  if (env.customerAccountEndpoint) {
    endpointCache = env.customerAccountEndpoint
    return endpointCache
  }

  const response = await fetch(
    `https://${env.storeDomain}/.well-known/customer-account-api`,
  )
  if (!response.ok) {
    throw new CustomerAccountError('Could not locate the Customer Account API.', {
      code: 'discovery_failed',
    })
  }
  const body = await response.json()
  endpointCache = body.graphql_api
  logger.info('discovered customer account api', { endpoint: endpointCache })
  return endpointCache
}

async function query(accessToken, graphql, variables = {}) {
  const url = await endpoint()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken,
    },
    body: JSON.stringify({ query: graphql, variables }),
  })

  if (response.status === 401 || response.status === 403) {
    throw new CustomerAccountError('Your session has expired. Please sign in again.', {
      code: 'unauthorized',
    })
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new CustomerAccountError(`Customer Account API HTTP ${response.status}`, {
      code: `http_${response.status}`,
    })
  }
  if (body?.errors?.length) {
    logger.error('customer account graphql errors', { errors: body.errors.slice(0, 3) })
    throw new CustomerAccountError(body.errors[0].message, { code: 'graphql' })
  }

  return body.data
}

/**
 * PROCESSED_AT + reverse is Shopify's own newest-first ordering, so there is
 * no client-side sort to drift out of step.
 */
const ORDERS = `
  query orders($first: Int!) {
    customer {
      id
      firstName
      lastName
      emailAddress { emailAddress }
      orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            number
            processedAt
            financialStatus
            fulfillmentStatus
            statusPageUrl
            totalPrice { amount currencyCode }
            fulfillments(first: 3) {
              edges {
                node {
                  status
                  trackingInformation { company number url }
                }
              }
            }
            lineItems(first: 20) {
              edges {
                node {
                  title
                  quantity
                  variantTitle
                  image { url }
                }
              }
            }
          }
        }
      }
    }
  }
`

export async function fetchOrders(accessToken, { limit = 10 } = {}) {
  const data = await query(accessToken, ORDERS, { first: limit })
  const customer = data?.customer

  if (!customer) {
    throw new CustomerAccountError('Your session has expired. Please sign in again.', {
      code: 'unauthorized',
    })
  }

  return {
    customer: {
      email: customer.emailAddress?.emailAddress || null,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
    },
    orders: (customer.orders?.edges || []).map((edge) => normalise(edge.node)),
  }
}

/** Flattens the GraphQL connections into the shape tools/order.js expects. */
function normalise(order) {
  return {
    id: order.id,
    name: order.name,
    orderNumber: order.number,
    processedAt: order.processedAt,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    cancelReason: null,
    canceledAt: null,
    statusUrl: order.statusPageUrl,
    totalPrice: order.totalPrice,
    currentTotalPrice: order.totalPrice,
    shippingAddress: null,
    successfulFulfillments: (order.fulfillments?.edges || []).map((edge) => ({
      trackingCompany: edge.node.trackingInformation?.[0]?.company || null,
      trackingInfo: (edge.node.trackingInformation || []).map((info) => ({
        number: info.number,
        url: info.url,
      })),
    })),
    lineItems: {
      edges: (order.lineItems?.edges || []).map((edge) => ({
        node: {
          title: edge.node.title,
          quantity: edge.node.quantity,
          variant: {
            title: edge.node.variantTitle,
            image: edge.node.image,
          },
        },
      })),
    },
  }
}
