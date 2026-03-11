# Playwright Library Architecture: Client, Server, and Dispatchers

Playwright uses a client-server architecture connected by a protocol layer. The client provides the public API, the server performs actual browser automation, and dispatchers bridge the two over an RPC channel.

## Package Layout

```
packages/protocol/src/
  protocol.yml              — RPC protocol definition (source of truth)
  channels.d.ts             — generated TypeScript channel interfaces
  callMetadata.d.ts         — call metadata types

packages/playwright-core/src/
  client/                   — public API objects (ChannelOwner subclasses)
  server/                   — browser automation implementation (SdkObject subclasses)
  server/dispatchers/       — protocol bridge (Dispatcher subclasses)
  protocol/                 — validators (generated + primitives)
  utils/isomorphic/         — shared code used by both client and server
    protocolMetainfo.ts     — generated method metadata (flags, titles)
```

## Dependency Rules (DEPS.list)

Each directory has a `DEPS.list` constraining its imports. These are enforced by `npm run flint`.

**client/** can import from:
- `../protocol/` — validators and channel types
- `../utils/isomorphic` — shared utilities

**server/** can import from:
- `../protocol/`, `../utils/`, `../utils/isomorphic/`, `../utilsBundle.ts`
- `./` (own directory), `./codegen/`, `./isomorphic/`, `./har/`, `./recorder/`, `./registry/`, `./utils/`
- Only `playwright.ts` can import browser engines (`./chromium/`, `./firefox/`, `./webkit/`, `./bidi/`, `./android/`, `./electron/`)
- Only `devtoolsController.ts` can additionally import `./chromium/`

**server/dispatchers/** can import from:
- `../../protocol/`, `../../utils/`, `../../utils/isomorphic/`
- `../**` — all server modules

**Key rule:** Client code NEVER imports server code. Server code NEVER imports client code. They communicate only through the protocol.

## Protocol Layer

### protocol.yml

Defines all RPC interfaces, commands (methods), events, and types. Example:

```yaml
Page:
  type: interface
  extends: EventTarget
  initializer:
    mainFrame: Frame
    viewportSize: { type: object?, properties: { width: int, height: int } }
  commands:
    goto:
      parameters:
        url: string
        timeout: float
        waitUntil: LifecycleEvent?
      returns:
        response: Response?
  events:
    close: {}
    navigated:
      url: string
      name: string
```

### Code Generation

Running `node utils/generate_channels.js` (or via watch) produces:
- `packages/protocol/src/channels.d.ts` — TypeScript types: `PageChannel`, `PageGotoParams`, `PageGotoResult`, `PageInitializer`, event types
- `packages/playwright-core/src/protocol/validator.ts` — runtime validators: `scheme.PageGotoParams = tObject({...})`
- `packages/playwright-core/src/utils/isomorphic/protocolMetainfo.ts` — method flags (slowMo, snapshot, etc.)

### Wire Format

```
Client → Server (RPC call):   { id, guid, method, params, metadata? }
Server → Client (response):   { id, result } or { id, error, log? }
Server → Client (event):      { guid, method, params }
Server → Client (lifecycle):  { guid, method: '__create__'|'__adopt__'|'__dispose__', params }
```

Object references are serialized as `{ guid: "object-guid" }` and resolved by validators.

## Client Layer

### ChannelOwner — Base Class

Every client-side API object (Page, Frame, Browser, etc.) extends `ChannelOwner<T>`:

```
packages/playwright-core/src/client/channelOwner.ts
```

Key properties:
- `_connection: Connection` — the RPC connection
- `_channel: T` — Proxy that intercepts method calls and sends RPC messages
- `_guid: string` — unique identifier matching the server-side object
- `_type: string` — type name (e.g., 'Page', 'Frame')
- `_parent: ChannelOwner` — parent in the object tree
- `_objects: Map<string, ChannelOwner>` — child objects
- `_initializer` — initial state received from server on creation

How `_channel` works: It's a Proxy. When you call `this._channel.goto(params)`:
1. Proxy intercepts the `goto` property access
2. Finds the validator for `PageGotoParams`
3. Returns an async function that validates params, wraps in `_wrapApiCall`, and calls `_connection.sendMessageToServer()`

Event subscription optimization: `_eventToSubscriptionMapping` maps JS event names to protocol subscription events. When the first listener is added, calls `updateSubscription(event, true)` on the channel. When last listener is removed, calls `updateSubscription(event, false)`. This way the server only sends events that have listeners.

### Connection

```
packages/playwright-core/src/client/connection.ts
```

Manages the client-server transport:
- `_objects: Map<string, ChannelOwner>` — all live remote objects by GUID
- `_callbacks: Map<number, {resolve, reject}>` — pending RPC calls by message ID
- `sendMessageToServer(object, method, params, apiZone)` — sends RPC call, returns promise
- `dispatch(message)` — handles incoming messages:
  - Response (has `id`): resolves/rejects the matching callback
  - `__create__`: instantiates ChannelOwner subclass via factory switch
  - `__adopt__`: reparents a child object
  - `__dispose__`: disposes object and all children
  - Event (has `method`): emits on the object's `_channel`

### Representative Client Classes

| Class | File | Key delegation |
|-------|------|----------------|
| `Playwright` | `playwright.ts` | Root object; owns `chromium`, `firefox`, `webkit` BrowserTypes |
| `BrowserType` | `browserType.ts` | `launch()` → `_channel.launch()` |
| `Browser` | `browser.ts` | `newContext()` → `_channel.newContext()` |
| `BrowserContext` | `browserContext.ts` | Owns pages, routes, tracing, cookies |
| `Page` | `page.ts` | Delegates most calls to `_mainFrame`; owns keyboard/mouse/touchscreen |
| `Frame` | `frame.ts` | `goto()`, `click()`, `evaluate()` → `_channel.*` |
| `Locator` | `locator.ts` | Delegates to `Frame` methods with selector + `strict: true` |
| `ElementHandle` | `elementHandle.ts` | DOM element reference |

### Public API Exports

`packages/playwright-core/src/client/api.ts` exports all public classes.

## Server Layer

### SdkObject — Base Class

Every server-side domain object extends `SdkObject`:

```
packages/playwright-core/src/server/instrumentation.ts
```

Key properties:
- `guid: string` — unique identifier (shared with client-side ChannelOwner)
- `attribution: Attribution` — ownership chain: `{ playwright, browserType?, browser?, context?, page?, frame? }`
- `instrumentation: Instrumentation` — hooks for tracing, debugging, test runner integration

Attribution is inherited from parent on construction. Instrumentation hooks include:
`onBeforeCall`, `onAfterCall`, `onBeforeInputAction`, `onCallLog`, `onPageOpen/Close`, `onBrowserOpen/Close`, `onDialog`, `onDownload`.

### Key Server Classes

| Class | File | Purpose |
|-------|------|---------|
| `Playwright` | `playwright.ts` | Root entry point; creates BrowserTypes |
| `BrowserType` | `browserType.ts` | Launches browser processes |
| `Browser` | `browser.ts` | Abstract base; owns BrowserContexts |
| `BrowserContext` | `browserContext.ts` | Isolation boundary; owns pages, cookies, routes |
| `Page` | `page.ts` | Owns FrameManager, workers; delegates to `PageDelegate` |
| `FrameManager` | `frames.ts` | Manages frame hierarchy |
| `Frame` | `frames.ts` | Navigation, DOM queries, JavaScript evaluation |
| `ElementHandle` | `dom.ts` | DOM element operations |
| `ProgressController` | `progress.ts` | Wraps async operations with timeout/cancellation/logging |

### PageDelegate Pattern

`Page` delegates browser-specific operations to a `PageDelegate` interface:

```typescript
interface PageDelegate {
  navigateFrame(frame, url, referer): Promise<GotoResult>;
  takeScreenshot(progress, format, ...): Promise<Buffer>;
  adoptElementHandle(handle, to): Promise<ElementHandle>;
  // ... more browser-specific operations
}
```

Implementations:
- `packages/playwright-core/src/server/chromium/crPage.ts` — uses CDP
- `packages/playwright-core/src/server/firefox/ffPage.ts`
- `packages/playwright-core/src/server/webkit/wkPage.ts`

### Browser Engine Directories

| Directory | Protocol | Key files |
|-----------|----------|-----------|
| `chromium/` | Chrome DevTools Protocol (CDP) | `crBrowser.ts`, `crPage.ts`, `crConnection.ts` |
| `firefox/` | Firefox internal protocol | `ffBrowser.ts`, `ffPage.ts`, `ffConnection.ts` |
| `webkit/` | WebKit internal protocol | `wkBrowser.ts`, `wkPage.ts`, `wkConnection.ts` |
| `bidi/` | WebDriver BiDi | `bidiChromium.ts`, `bidiFirefox.ts` |
| `android/` | ADB | `android.ts` |
| `electron/` | Electron/CDP | `electron.ts` |

## Dispatcher Layer

Dispathers do not implement things, they translate protocol to the server code calls.

### Dispatcher — Base Class

```
packages/playwright-core/src/server/dispatchers/dispatcher.ts
```

Dispatchers bridge server objects to the protocol. Each wraps an `SdkObject` and exposes methods matching the protocol channel.

```typescript
class Dispatcher<Type extends SdkObject, ChannelType, ParentScopeType extends DispatcherScope>
```

Key properties:
- `connection: DispatcherConnection` — the server-side connection
- `_object: Type` — the wrapped server object
- `_guid: string` — same GUID as the server object
- `_type: string` — type name matching protocol
- `_parent: ParentScopeType` — parent dispatcher
- `_dispatchers: Map<string, DispatcherScope>` — child dispatchers

Key methods:
- `_dispatchEvent(method, params)` — sends event to client via `connection.sendEvent()`
- `_runCommand(callMetadata, method, params)` — wraps method call in `ProgressController`, calls `this[method](params, progress)`
- `_dispose()` — recursively disposes self and children, sends `__dispose__` to client
- `adopt(child)` — reparents child dispatcher, sends `__adopt__` to client
- `addObjectListener(event, handler)` — listens on wrapped server object, auto-cleaned on dispose

### Dispatcher Creation Pattern

Dispatchers use a static factory to ensure one-dispatcher-per-object:

```typescript
static from(parentScope, object): XxxDispatcher {
  return parentScope.connection.existingDispatcher<XxxDispatcher>(object) || new XxxDispatcher(parentScope, object);
}
```

The constructor sends `__create__` to the client with the initializer data.

### DispatcherConnection

Server-side counterpart to client's `Connection`:
- `_dispatcherByGuid` — all dispatchers by GUID
- `_dispatcherByObject` — maps server objects to their dispatchers (ensures 1:1)
- `dispatch(message)` — validates params, creates `CallMetadata`, calls instrumentation hooks, runs dispatcher method, validates result, sends response
- `sendCreate/sendAdopt/sendDispose/sendEvent` — lifecycle messages to client
- GC: buckets with limits (JSHandle/ElementHandle: 100k, others: 10k); oldest 10% disposed when exceeded

### Dispatcher Hierarchy

```
RootDispatcher
└── PlaywrightDispatcher
    ├── BrowserTypeDispatcher (per engine)
    │   └── BrowserDispatcher
    │       └── BrowserContextDispatcher
    │           ├── PageDispatcher
    │           │   ├── FrameDispatcher (main + child frames)
    │           │   ├── WorkerDispatcher
    │           │   └── ...
    │           ├── TracingDispatcher
    │           └── APIRequestContextDispatcher
    ├── AndroidDispatcher
    ├── ElectronDispatcher
    └── LocalUtilsDispatcher
```

### Key Dispatcher Files

| File | Dispatches for |
|------|---------------|
| `playwrightDispatcher.ts` | Playwright, BrowserType registration |
| `browserTypeDispatcher.ts` | BrowserType (launch, connect) |
| `browserDispatcher.ts` | Browser |
| `browserContextDispatcher.ts` | BrowserContext |
| `pageDispatcher.ts` | Page, Worker, BindingCall |
| `frameDispatcher.ts` | Frame |
| `networkDispatchers.ts` | Request, Response, Route, WebSocket, APIRequestContext |
| `elementHandlerDispatcher.ts` | ElementHandle |
| `jsHandleDispatcher.ts` | JSHandle |
| `dialogDispatcher.ts` | Dialog |
| `tracingDispatcher.ts` | Tracing |
| `artifactDispatcher.ts` | Artifact |

## End-to-End Flow Example

`await page.goto('https://example.com')`:

```
CLIENT:
  Page.goto()
    → _wrapApiCall() captures stack trace, creates ApiZone
      → _channel.goto({ url, timeout })
        → Proxy validates PageGotoParams
        → connection.sendMessageToServer(page, 'goto', params)
          → sends { id: 1, guid: 'page@abc', method: 'goto', params: {...} }
          → waits on callback promise

SERVER:
  DispatcherConnection.dispatch(message)
    → validates PageGotoParams (wire → objects)
    → creates CallMetadata
    → instrumentation.onBeforeCall()
    → PageDispatcher._runCommand('goto', params)
      → ProgressController.run(progress => this.goto(params, progress))
        → PageDispatcher.goto():  this._object.mainFrame().goto(progress, url, params)
          → Frame.goto() → PageDelegate.navigateFrame() → CDP/protocol call
    → validates PageGotoResult (objects → wire)
    → instrumentation.onAfterCall()
    → sends { id: 1, result: { response: { guid: 'response@xyz' } } }

CLIENT:
  connection.dispatch(response)
    → validates PageGotoResult (wire → objects)
    → resolves callback promise
    → _wrapApiCall completes, returns Response object
```

## Object Lifecycle

1. **Creation**: Server creates SdkObject → dispatcher constructor sends `__create__` → client `Connection.dispatch()` instantiates `ChannelOwner` subclass
2. **Adoption**: `dispatcher.adopt(child)` sends `__adopt__` → client reparents the `ChannelOwner`
3. **Disposal**: `dispatcher._dispose()` recursively disposes children → sends `__dispose__` → client removes `ChannelOwner` from maps
4. **GC**: Server-side `maybeDisposeStaleDispatchers()` evicts oldest dispatchers per bucket when limits exceeded

## Testing: tests/library vs tests/page

Tests live in two directories under `tests/`, each with distinct scope and fixtures.

### tests/library — API and Feature Tests

Tests the **Playwright public API surface**, browser lifecycle, and feature-level behavior. Uses `browserTest` fixtures which provide direct access to `browser`, `browserType`, `context`, and `contextFactory`.

```typescript
import { browserTest as test, expect } from '../config/browserTest';

test('should create new page', async ({ browser }) => {
  const page = await browser.newPage();
  expect(browser.contexts().length).toBe(1);
  await page.close();
});
```

**What belongs here:**
- Browser and BrowserType API (`launch`, `connect`, `version`, `newContext`)
- BrowserContext API (cookies, storage state, permissions, proxy, CSP, geolocation, network interception at context level)
- Browser-specific features (`chromium/` for CDP, tracing, extensions, JS/CSS coverage, OOPIF; `firefox/` for launcher specifics)
- Protocol and channel tests
- Inspector, codegen, and recorder features (`inspector/`)
- Event system tests (`events/`)
- Unit tests for internal utilities (`unit/`)

**Key fixtures** (from `browserTest`): `browser`, `browserType`, `context`, `contextFactory`, `launchPersistent`, `createUserDataDir`, `startRemoteServer`, `pageWithHar`.

### tests/page — Page Interaction Tests

Tests **user-facing page interactions**: clicking, typing, navigation, locators, assertions, and DOM operations. Uses `pageTest` fixtures which provide a ready-to-use `page` plus test servers.

```typescript
import { test as it, expect } from './pageTest';

it('should click button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.locator('button').click();
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});
```

**What belongs here:**
- Locator API (click, fill, type, select, query, filtering, convenience methods)
- ElementHandle interactions (click, screenshot, selection, bounding box)
- Expect/assertion matchers (boolean, text, value, accessibility)
- Page navigation (`goto`, `waitForNavigation`, `waitForURL`)
- Frame evaluation and hierarchy
- Request/response interception at page level
- JSHandle operations
- Screenshot and visual comparison tests

**Key fixtures** (from `pageTest`/`serverFixtures`): `page`, `server`, `httpsServer`, `proxyServer`, `asset`.

### Decision Rule

| Question | → Directory |
|----------|-------------|
| Does it test browser/context lifecycle or launch options? | `tests/library` |
| Does it test a browser-specific protocol feature (CDP, etc.)? | `tests/library` |
| Does it test user interaction with page content (click, type, assert)? | `tests/page` |
| Does it test locators, selectors, or DOM queries? | `tests/page` |
| Does the test need direct `browser` or `browserType` access? | `tests/library` |
| Does the test just need a `page` and a test server? | `tests/page` |

### Running Tests

- `npm run ctest <file>` — runs on Chromium only (fast, use during development)
- `npm run test <file>` — runs on all browsers (Chromium, Firefox, WebKit)

Examples:
```bash
npm run ctest tests/library/browser-context-cookies.spec.ts
npm run ctest tests/page/locator-click.spec.ts
npm run test tests/library/browser-context-cookies.spec.ts
```

### Configuration

Both directories share a single config at `tests/library/playwright.config.ts`. It creates separate projects (`{browserName}-library` and `{browserName}-page`) pointing to their respective `testDir`.
