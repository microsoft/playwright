# Bundling for Web

Playwright contains a version bundled for web browsers under `playwright/web.js`, which
installs playwright under `window.playwrightweb`.
You can use it in the web page to drive another browser instance.

API consists of a single `connect` function, similar to
[chromiumPlaywright.connect(options)](api.md#chromiumplaywrightconnectoptions),
[firefoxPlaywright.connect(options)](api.md#firefoxplaywrightconnectoptions) and
[webkitPlaywright.connect(options)](api.md#webkitplaywrightconnectoptions).

```html
<script src='../playwright/web.js'></script>
<script>
async function usePlaywright() {
  const connect = window.playwrightweb('chromium'); // or 'firefox', 'webkit'
  const browser = await connect(options);
  // ... drive automation ...
  await browser.disconnect();
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
