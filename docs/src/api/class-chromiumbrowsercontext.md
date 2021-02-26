# class: ChromiumBrowserContext
* langs: js, python
* extends: [BrowserContext]

Chromium-specific features including background pages, service worker support, etc.

```js
const backgroundPage = await context.waitForEvent('backgroundpage');
```

```python async
background_page = await context.wait_for_event("backgroundpage")
```

```python sync
background_page = context.wait_for_event("backgroundpage")
```

## event: ChromiumBrowserContext.backgroundPage
- argument: <[Page]>

Emitted when new background page is created in the context.

:::note
Only works with persistent context.
:::

## event: ChromiumBrowserContext.serviceWorker
- argument: <[Worker]>

Emitted when new service worker is created in the context.

## method: ChromiumBrowserContext.backgroundPages
- returns: <[Array]<[Page]>>

All existing background pages in the context.

## async method: ChromiumBrowserContext.newCDPSession
- returns: <[CDPSession]>

Returns the newly created session.

### param: ChromiumBrowserContext.newCDPSession.page
- `page` <[Page]>

Page to create new session for.

## method: ChromiumBrowserContext.serviceWorkers
- returns: <[Array]<[Worker]>>

All existing service workers in the context.
