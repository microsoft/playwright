# Bundling For Web Browsers

To bundle Playwright using [Browserify](http://browserify.org/):

1. Clone Playwright repository: `git clone https://github.com/Microsoft/playwright && cd playwright`
2. `npm install`
3. Run `npm run bundle`

This will create `./utils/browser/playwright-web.js` file that contains Playwright bundle.

You can use it later on in your web page to drive
another browser instance through its WS Endpoint:

```html
<script src='./playwright-web.js'></script>
<script>
  const playwright = require('playwright');
  const browser = await playwright.connect({
    browserWSEndpoint: '<another-browser-ws-endpont>'
  });
  // ... drive automation ...
</script>
```

See our [playwright-web tests](https://github.com/Microsoft/playwright/blob/master/utils/browser/test.js)
for details.

### Running inside Chrome Extension

You might want to enable `unsafe-eval` inside the extension by adding the following
to your `manifest.json` file:

```
"content_security_policy": "script-src 'self' 'unsafe-eval'; object-src 'self'"
```

Please see discussion in https://github.com/GoogleChrome/puppeteer/issues/3455.
