import ChatWidget from './components/ChatWidget/ChatWidget.jsx'

/**
 * Host page for the widget. In a real storefront this is the merchant's page
 * and only <ChatWidget /> would be embedded.
 */
export default function App() {
  return (
    <div className="host-page">
      <main className="host-page__content">
        <p className="host-page__eyebrow">Shopify UCP Agent</p>
        <h1 className="host-page__title">Chat widget preview</h1>
        <p className="host-page__body">
          The widget is mounted bottom-right. It is UI only — no agent is connected yet.
        </p>
      </main>

      <ChatWidget
        storeName="Agentic Training"
        greeting="Hi! I can help you find products, build a cart, and check out."
      />
    </div>
  )
}
