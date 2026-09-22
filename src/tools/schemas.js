/**
 * Claude-facing tool schemas.
 *
 * These are deliberately NOT the raw UCP schemas. Differences on purpose:
 *   - prices are in major units ($100), because that is how buyers talk;
 *     src/tools/catalog.js converts to minor units for Shopify
 *   - colour and size exist here even though UCP has no such filter; we apply
 *     them ourselves
 *   - meta / signals / context are omitted; the server fills them in
 */

export const searchCatalogSchema = {
  name: 'search_catalog',
  description: [
    'Search the store catalogue. Use this for any question about what products',
    'exist, what they cost, or what is available — never answer from memory.',
    'Accepts free text (keywords, product titles, description phrases) and/or',
    'structured filters. At least one of query, colour, size, price, or',
    'categories must be given.',
    'Prices in this schema are in normal currency units (e.g. 100 means $100).',
    'Results are already sorted, filtered and limited per the store config, so',
    'present them in the order returned.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Free-text search over product titles and descriptions, e.g. "linen summer shirt". Use the buyer\'s own words.',
      },
      color: {
        type: 'string',
        description:
          'Colour the buyer asked for, e.g. "blue". Matched against variant options.',
      },
      size: {
        type: 'string',
        description:
          'Size the buyer asked for, e.g. "M" or "Large". Matched against variant options.',
      },
      price_min: {
        type: 'number',
        description: 'Lowest acceptable price in normal currency units (100 = $100).',
      },
      price_max: {
        type: 'number',
        description: 'Highest acceptable price in normal currency units (100 = $100).',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Category names to narrow to. Combined with OR.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        description:
          'Override how many products to return. Omit unless the buyer asked for a specific number.',
      },
      cursor: {
        type: 'string',
        description:
          'Pagination cursor from a previous search, to fetch the next page when the buyer asks for more.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

/* ---------------------------------------------------------------------- cart */

const VARIANT_ID = {
  type: 'string',
  description:
    'The variant id from a search result, e.g. "gid://shopify/ProductVariant/123". A product id will not work — pick the specific variant (size/colour) the buyer wants.',
}

export const addToCartSchema = {
  name: 'add_to_cart',
  description: [
    'Add a product variant to the buyer\'s cart, creating the cart if there is not one yet.',
    'You must have a variant id from search_catalog — never guess one.',
    'If the buyer has not chosen a size or colour and the product has several,',
    'ask which one before calling this.',
    'Adding a variant that is already in the cart increases its quantity.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      variant_id: VARIANT_ID,
      quantity: {
        type: 'integer',
        minimum: 1,
        description: 'How many to add. Defaults to 1.',
      },
    },
    required: ['variant_id'],
    additionalProperties: false,
  },
}

export const updateCartItemSchema = {
  name: 'update_cart_item',
  description: [
    'Set the quantity of an item already in the cart to an absolute number.',
    '"Make it 3" means quantity 3, not 3 more. Quantity 0 removes the item.',
    'Identify the line by variant_id or line_item_id from the last cart view.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      variant_id: VARIANT_ID,
      line_item_id: {
        type: 'string',
        description: 'The line_item_id from a previous cart result.',
      },
      quantity: {
        type: 'integer',
        minimum: 0,
        description: 'The new total quantity for this line. 0 removes it.',
      },
    },
    required: ['quantity'],
    additionalProperties: false,
  },
}

export const removeFromCartSchema = {
  name: 'remove_from_cart',
  description:
    'Remove an item from the cart entirely. Identify it by variant_id or line_item_id.',
  input_schema: {
    type: 'object',
    properties: {
      variant_id: VARIANT_ID,
      line_item_id: {
        type: 'string',
        description: 'The line_item_id from a previous cart result.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

export const applyDiscountCodeSchema = {
  name: 'apply_discount_code',
  description: [
    'Apply a discount or promo code to the cart.',
    'Only call this when the buyer actually gives you a code — never invent one,',
    'never guess, and do not prompt for one unprompted.',
    'The result tells you whether it was accepted: check `accepted`. A code can',
    'be rejected for being expired, mistyped, or not valid for the items in the',
    'cart, and the reason comes back in `error`.',
    'Works for any Shopify discount type (order, product, collection, shipping).',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The discount code exactly as the buyer gave it. Case-insensitive.',
      },
    },
    required: ['code'],
    additionalProperties: false,
  },
}

export const removeDiscountCodeSchema = {
  name: 'remove_discount_code',
  description:
    'Remove a discount code the buyer previously applied. Automatic discounts cannot be removed — they are applied by the store, not by a code.',
  input_schema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The code to remove.' },
    },
    required: ['code'],
    additionalProperties: false,
  },
}

export const viewCartSchema = {
  name: 'view_cart',
  description: [
    "Show what is in the buyer's cart, with quantities and totals.",
    'Call this whenever they ask about their cart, and after any change if you',
    'are unsure of the current contents.',
  ].join(' '),
  input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
}

export const clearCartSchema = {
  name: 'clear_cart',
  description:
    'Empty the cart completely. Only call this when the buyer clearly asks to start over or empty their cart.',
  input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
}

/* -------------------------------------------------------------------- orders */

export const listOrdersSchema = {
  name: 'list_orders',
  description: [
    "List the signed-in customer's recent orders, newest first, with order",
    'number, date, payment status, fulfilment status and total.',
    'Call this whenever the buyer asks about their orders, an order status, a',
    'delivery, or a refund.',
    'If they are not signed in this returns authenticated:false and a sign-in',
    'panel appears in the UI — tell them to sign in there. NEVER ask the buyer',
    'to type their password to you.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        description: 'How many recent orders to return. Omit for the configured default.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

export const trackOrderSchema = {
  name: 'track_order',
  description: [
    'Get the live detail for ONE specific order the customer has already been',
    'shown — status, tracking numbers and items. Identify it by order name',
    '(e.g. "#1042") or order id from list_orders.',
    'Use list_orders first if you do not know which order they mean.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      order_name: {
        type: 'string',
        description: 'The order name or number as shown to the buyer, e.g. "#1042".',
      },
      order_id: {
        type: 'string',
        description: 'The order id from a previous list_orders result.',
      },
    },
    required: [],
    additionalProperties: false,
  },
}

/* ------------------------------------------------------------------ policies */

export const searchStorePoliciesSchema = {
  name: 'search_store_policies',
  description: [
    "Search the store's policy pages (shipping, returns, privacy, warranty)",
    'for text relevant to the buyer\'s question. Use this for any question',
    'about policy — never answer one from memory.',
    'If it returns found:false, tell the buyer plainly that the policy pages',
    'do not cover that. Never invent policy detail that was not returned here.',
  ].join(' '),
  input_schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: "The buyer's question, in their own words.",
      },
    },
    required: ['question'],
    additionalProperties: false,
  },
}

export const toolSchemas = [
  searchCatalogSchema,
  addToCartSchema,
  updateCartItemSchema,
  removeFromCartSchema,
  applyDiscountCodeSchema,
  removeDiscountCodeSchema,
  viewCartSchema,
  clearCartSchema,
  listOrdersSchema,
  trackOrderSchema,
  searchStorePoliciesSchema,
]
