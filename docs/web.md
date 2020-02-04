# Bundling for Web

Playwright contains a version bundled for web browsers under `playwright/web.js`, which
installs playwright under `window.playwrightweb`.
You can use it in the web page to drive another browser instance.

API consists of a single `connect` function, similar to [browserType.connect(options)](api.md#browsertypeconnectoptions).

```html
<script src='playwright/web.js'></script>
<script>
async function usePlaywright() {
  const browser = await window.playwrightweb.chromium.connect(options); // or 'firefox', 'webkit'
  // ... drive automation ...
  await browser.close();
}
</script>
```

See our [playwright-web tests](https://github.com/Microsoft/playwright/blob/master/test/web.spec.js) for example.

### Running inside Chrome Extension

You might want to enable `unsafe-eval` inside the extension by adding the following
to your `manifest.json` file:

```
"content_security_policy": "script-src 'self' 'unsafe-eval'; object-src 'self'"
```

Please see discussion in https://github.com/GoogleChrome/puppeteer/issues/3455.
