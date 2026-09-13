import { toolSchemas } from './schemas.js'
import { searchCatalog } from './catalog.js'
import {
  addToCart,
  updateCartItem,
  removeFromCart,
  viewCart,
  clearCart,
  applyDiscountCode,
  removeDiscountCode,
} from './cart.js'
import { listOrders, trackOrder } from './order.js'

/**
 * Tool registry. Each handler is (input, config, session) and returns
 * { forModel, forUi }:
 *   forModel -> becomes the tool_result Claude sees (kept small)
 *   forUi    -> attached to the chat response for the widget to render
 *
 * Cart handlers mutate session.cartId, which is why session is passed in
 * rather than the cart id travelling through the model.
 */
const handlers = {
  search_catalog: searchCatalog,
  add_to_cart: addToCart,
  update_cart_item: updateCartItem,
  remove_from_cart: removeFromCart,
  view_cart: viewCart,
  clear_cart: clearCart,
  apply_discount_code: applyDiscountCode,
  remove_discount_code: removeDiscountCode,
  list_orders: listOrders,
  track_order: trackOrder,
}

export const tools = toolSchemas

export function isKnownTool(name) {
  return Object.hasOwn(handlers, name)
}

export async function executeTool(name, input, config, session) {
  const handler = handlers[name]
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`)
  }
  return handler(input, config, session)
}
