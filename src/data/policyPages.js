/**
 * Store policy pages, in lieu of a live fetch from the Shopify admin. Swap
 * this for a real source (e.g. the Storefront API's shop.shippingPolicy /
 * refundPolicy / privacyPolicy) without touching anything in src/rag/.
 */
export const policyPages = [
  {
    id: 'shipping',
    title: 'Shipping Policy',
    text: `Orders placed before 2pm ET ship the same business day; orders placed after that cutoff ship the next business day. Standard shipping within the continental US takes 3 to 5 business days and is free on orders over $75, otherwise a flat $6 fee applies. Expedited shipping takes 1 to 2 business days for a flat $18 fee. We currently ship to the United States and Canada only. Canadian orders may take 7 to 12 business days and the buyer is responsible for any customs duties or import taxes assessed on delivery. Once an order ships, a tracking number is emailed automatically and also appears in the buyer's order history. We are not responsible for delays caused by the carrier once a package leaves our warehouse, but we will help track down a lost shipment if tracking shows no movement for more than 7 days.`,
  },
  {
    id: 'returns',
    title: 'Returns & Refunds Policy',
    text: `Items may be returned within 30 days of delivery for a full refund to the original payment method, provided they are unworn, unwashed, and have their original tags attached. Final sale items, marked clearly at checkout, cannot be returned or exchanged. To start a return, use the return link in your shipping confirmation email or contact support with your order number. Once we receive and inspect the returned item, refunds are issued within 5 to 7 business days; the buyer's bank may take a few additional days to post the credit. Exchanges for a different size or colour follow the same 30-day window and ship out as soon as the original item is received back at our warehouse. Return shipping is free for defective or mis-shipped items; for all other returns, a prepaid label is available for $5, deducted from the refund.`,
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    text: `We collect the information needed to process orders and improve the shopping experience: name, shipping and billing address, email, and order history. Payment card details are handled entirely by our payment processor and are never stored on our servers. We use browsing and purchase data to personalise product recommendations and to measure which marketing channels are working, but we do not sell customer data to third parties. Customers can request a copy of their data, or ask that it be deleted, by contacting support; deletion requests are honoured within 30 days except where records must be retained for tax or legal reasons. Cookies are used for cart persistence and analytics; disabling them in your browser will not prevent checkout but may reset your cart between visits.`,
  },
  {
    id: 'warranty',
    title: 'Warranty Policy',
    text: `All apparel is covered by a 90-day warranty against manufacturing defects such as seam failure, faulty zippers, or fabric that pills excessively under normal wear. The warranty does not cover ordinary wear and tear, damage from improper washing, or alterations made after purchase. To make a warranty claim, contact support with your order number and photos of the defect; approved claims are resolved with a free repair, a replacement of the same item, or store credit, at the customer's choice. Warranty claims are handled separately from the 30-day return window and remain available even after that window has closed, as long as the claim is made within 90 days of delivery.`,
  },
]
