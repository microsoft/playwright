# Updating WebKit Safari Version

The Safari version string used in the WebKit user-agent is declared in one place:

**[packages/playwright-core/src/server/webkit/wkBrowser.ts](../../../packages/playwright-core/src/server/webkit/wkBrowser.ts)** — `BROWSER_VERSION` constant (line ~35).

```ts
const BROWSER_VERSION = '26.4';
const DEFAULT_USER_AGENT = `Mozilla/5.0 ... Version/${BROWSER_VERSION} Safari/605.1.15`;
```

## Steps to update

1. **Find the latest stable Safari version** — search `site:developer.apple.com "Safari X.Y Release Notes"` or check the [Safari Release Notes](https://developer.apple.com/documentation/safari-release-notes) index. The highest numbered entry that is not a Technology Preview is the current stable release.

2. **Update `BROWSER_VERSION`** in `wkBrowser.ts`.

That is the only file that needs changing — the user-agent string is built from the constant automatically.
