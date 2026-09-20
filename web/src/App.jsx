import ChatWidget from './components/ChatWidget/ChatWidget.jsx'

/**
 * Host page for the widget. In a real storefront this is the merchant's page
 * and only <ChatWidget /> would be embedded.
 */
export default function App() {
  const params = new URLSearchParams(window.location.search)

  // The Shopify embed loads this app inside an iframe with `?embed=1` — skip
  // the local preview chrome and post open/close state to the parent page so
  // its iframe can resize around the launcher vs. the full panel.
  if (params.get('embed') === '1') {
    document.body.classList.add('cw-embed')
    return (
      <ChatWidget
        storeName={params.get('store') || 'Store'}
        greeting={params.get('greeting') || ''}
        onOpenChange={(open) =>
          window.parent.postMessage({ source: 'ucp-chat-widget', type: open ? 'open' : 'close' }, '*')
        }
      />
    )
  }

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
