# Embedding the widget on a Shopify storefront

The widget runs same-origin on the deployed agent server (`web/dist`, served by
`src/server/app.js`), so it's embedded via an iframe rather than a script tag —
that keeps the widget's CSS reset (`web/src/styles/global.css`) from touching
the theme's own styles.

Paste this in the theme editor under **Online Store → Themes → Edit code →
`layout/theme.liquid`**, just before `</body>`. Replace `YOUR-APP` with the
Render service's hostname and `Your Store Name` with the greeting text you
want.

```html
<!-- UCP Chat Widget -->
<iframe
  id="ucp-chat-widget"
  title="Chat with us"
  src="https://YOUR-APP.onrender.com/?embed=1&store=Your%20Store%20Name&greeting=Hi!%20How%20can%20I%20help%3F"
  allow="microphone"
  style="position:fixed;bottom:0;right:0;width:76px;height:76px;border:none;background:transparent;z-index:999999;transition:width .15s ease,height .15s ease;"
></iframe>
<script>
  (function () {
    var frame = document.getElementById('ucp-chat-widget')
    window.addEventListener('message', function (event) {
      if (event.source !== frame.contentWindow) return
      var data = event.data
      if (!data || data.source !== 'ucp-chat-widget') return
      if (data.type === 'open') {
        frame.style.width = 'min(424px, 100vw)'
        frame.style.height = 'min(680px, 100vh)'
      } else if (data.type === 'close') {
        frame.style.width = '76px'
        frame.style.height = '76px'
      }
    })
  })()
</script>
```

The iframe starts sized to just the launcher button; `App.jsx`'s embed mode
posts an `open`/`close` message whenever the panel toggles, and the inline
script above resizes the frame to fit. `allow="microphone"` lets the voice
input control ask for mic access from inside the iframe.

On the server, set `WIDGET_ORIGIN` and `PUBLIC_BASE_URL` to the Render app's
own URL (e.g. `https://YOUR-APP.onrender.com`) — not the Shopify domain. Those
only gate the customer sign-in popup handshake, which happens between windows
opened by the widget itself, independent of which page iframes it in.
