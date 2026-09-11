/**
 * Exercises the cart tools against a stand-in UCP server (UCP_ENDPOINT), so the
 * quantity / removal / totals logic can be verified even when the live store
 * has no purchasable stock.
 *
 *   node /tmp/fakeucp/server.mjs &
 *   UCP_ENDPOINT=http://localhost:4555/mcp node scripts/cart-selftest.mjs
 */
import assert from 'node:assert/strict'
import { addToCart, updateCartItem, removeFromCart, viewCart, clearCart } from '../src/tools/cart.js'
import { catalogConfig } from '../src/config/catalog.config.js'

const A = 'gid://shopify/ProductVariant/A'
const B = 'gid://shopify/ProductVariant/B'
const session = { id: 'test', cartId: null }
const cfg = catalogConfig
const show = (label, r) => {
  const c = r.forUi.cart
  console.log(`${label.padEnd(34)} items=${c.itemCount}  ${c.lineItems.map(l => `${l.title.split(' - ')[0]}x${l.quantity}=${l.lineTotal.formatted}`).join(', ') || '(empty)'}  total=${c.total?.formatted ?? '-'}`)
  return c
}

let c = show('1 add A x1', await addToCart({ variant_id: A }, cfg, session))
assert.equal(c.itemCount, 1); assert.equal(c.total.formatted, '$88.00')
assert.ok(session.cartId, 'cart id stored on session')

c = show('2 add A x2 (increments)', await addToCart({ variant_id: A, quantity: 2 }, cfg, session))
assert.equal(c.lineItems.length, 1, 'must not duplicate the line')
assert.equal(c.itemCount, 3); assert.equal(c.total.formatted, '$264.00')

c = show('3 add B x1', await addToCart({ variant_id: B }, cfg, session))
assert.equal(c.lineItems.length, 2); assert.equal(c.total.formatted, '$389.00')

c = show('4 set A qty 5 (absolute)', await updateCartItem({ variant_id: A, quantity: 5 }, cfg, session))
assert.equal(c.lineItems.find(l => l.variantId === A).quantity, 5)
assert.equal(c.total.formatted, '$565.00')

c = show('5 set A qty 0 (removes)', await updateCartItem({ variant_id: A, quantity: 0 }, cfg, session))
assert.equal(c.lineItems.length, 1); assert.equal(c.total.formatted, '$125.00')

const byLineId = (await viewCart({}, cfg, session)).forUi.cart.lineItems[0].id
c = show('6 remove by line_item_id', await removeFromCart({ line_item_id: byLineId }, cfg, session))
assert.equal(c.itemCount, 0); assert.equal(c.empty, true)

await addToCart({ variant_id: B, quantity: 2 }, cfg, session)
c = show('7 view_cart', await viewCart({}, cfg, session))
assert.equal(c.itemCount, 2)
assert.ok(c.checkoutUrl, 'checkout url present')

c = show('8 clear_cart', await clearCart({}, cfg, session))
assert.equal(c.empty, true); assert.equal(session.cartId, null, 'cart id cleared from session')

// Guard rails
await assert.rejects(() => addToCart({ variant_id: 'gid://shopify/Product/123' }, cfg, session), /variant id is required/)
await assert.rejects(() => addToCart({ variant_id: A, quantity: 0 }, cfg, session), /at least 1/)
console.log('9 rejects product id and qty<1'.padEnd(34) + 'ok')

// Updating a line that is not in the cart must inform the model, not throw.
await addToCart({ variant_id: A }, cfg, session)
const missing = await updateCartItem({ variant_id: 'gid://shopify/ProductVariant/ZZZ', quantity: 2 }, cfg, session)
assert.match(missing.forModel.error, /not in the cart/)
console.log('10 unknown line -> tells the model'.padEnd(34) + 'ok')

// Acting on a cart that does not exist yet is an error the agent can explain.
await clearCart({}, cfg, session)
await assert.rejects(() => updateCartItem({ variant_id: A, quantity: 1 }, cfg, session), /no cart/i)
await assert.rejects(() => removeFromCart({ variant_id: A }, cfg, session), /no cart/i)
assert.equal((await viewCart({}, cfg, session)).forUi.cart.empty, true)
console.log('11 no-cart paths behave'.padEnd(34) + 'ok')

console.log('\nall cart assertions passed')
