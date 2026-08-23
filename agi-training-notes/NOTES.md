# Playwright & Playwright-Core Architecture Notes

This document summarizes the internal architecture and operational mechanisms of `playwright-core`, Playwright's `codegen`, the `@playwright/test` test runner, and Playwright's tracing & frame subsystem based on source reading of upstream Playwright.

> **Provenance**
> - Source Commit: `b4a646a624c0b1e8e352d320cbc6684581625ff6`
> - Commit Date: `2026-08-06`
> - Methodology: Static-source analysis of upstream Playwright TypeScript files. Runtime/browser behavior was not exercised.

---

## 1. Browser Launch Mechanism

### Architecture & Flow
1. **Public API Entry Point**: Calling `chromium.launch(options)`, `firefox.launch(options)`, or `webkit.launch(options)` executes `BrowserType.launch(options)` in `packages/playwright-core/src/client/browserType.ts`.
2. **RPC Dispatch**: `BrowserType.launch()` wraps launch parameters (environment variables, default args overrides, timeouts) and issues a `this._channel.launch(...)` RPC request over the Playwright connection channel to the backend server process.
3. **Server Launch Processing**: `BrowserType.launch(progress, options, protocolLogger)` in `packages/playwright-core/src/server/browserType.ts`:
   - Validates launch options via `_validateLaunchOptions()`.
   - Prepares profile directories and temporary artifact folders via `_prepareToLaunch()`.
   - Resolves the binary executable using `registry.findExecutable(name)` in `packages/playwright-core/src/server/registry/index.ts`.
   - Spawns the child process via `launchProcess()` from `@utils/processLauncher`.
   - Establishes a transport connection using `this.connectToTransport(transport, browserOptions)`.
4. **Engine-Specific Launchers**:
   - **Chromium** (`packages/playwright-core/src/server/chromium/chromium.ts` -> `Chromium.launch`): Connects via Chrome DevTools Protocol (CDP) through `CRBrowser.connect()` in `packages/playwright-core/src/server/chromium/crBrowser.ts`.
   - **Firefox** (`packages/playwright-core/src/server/firefox/firefox.ts` -> `Firefox.launch`): Connects via Firefox protocol / JSDebugger through `FFBrowser.connect()` in `packages/playwright-core/src/server/firefox/ffBrowser.ts`.
   - **WebKit** (`packages/playwright-core/src/server/webkit/webkit.ts` -> `WebKit.connectToTransport`): Connects via WebKit Inspector protocol through `WKBrowser.connect()` in `packages/playwright-core/src/server/webkit/wkBrowser.ts`.

---

## 2. BrowserContext and Page Ownership & Relationships

### BrowserContext
- **Client Class**: `BrowserContext` in `packages/playwright-core/src/client/browserContext.ts`.
- **Server Class**: `BrowserContext` in `packages/playwright-core/src/server/browserContext.ts`.
- **Responsibilities**:
  - Acts as an isolated session boundary (equivalent to an incognito profile with isolated cookies, localStorage, IndexedDB, HTTP credentials, proxy settings, permissions, and storage state).
  - Owns a set of active page instances (`_pages: Set<Page>`).
  - Owns context-level network interception handlers (`_routes: RouteHandler[]`).
  - Owns context-wide auxiliary services: `request: APIRequestContext`, `tracing: Tracing`, `clock: Clock`, `credentials: Credentials`, `debugger: Debugger`.
  - Spawns new pages via `newPage()`, which sends `_channel.newPage()` to the server.

### Page
- **Client Class**: `Page` in `packages/playwright-core/src/client/page.ts`.
- **Server Class**: `Page` in `packages/playwright-core/src/server/page.ts`.
- **Responsibilities**:
  - Belongs to a single parent `BrowserContext` (`_browserContext: BrowserContext`).
  - Owns the document frame hierarchy starting from top-level `_mainFrame: Frame` and child frames in `_frames: Set<Frame>`.
  - Owns input device controllers: `keyboard: Keyboard`, `mouse: Mouse`, `touchscreen: Touchscreen` (defined in `packages/playwright-core/src/client/input.ts`).
  - Owns page-level network routes (`_routes: RouteHandler[]`).
  - Manages page lifecycle events (`load`, `domcontentloaded`, `console`, `dialog`, `download`, `filechooser`, `popup`, `close`, `crash`).

---

## 3. Locator Architecture, Selector Resolution, and Auto-Waiting

### Locator Definition
- **Client Class**: `Locator` in `packages/playwright-core/src/client/locator.ts`.
- Locators are **lazy descriptors**. Creating a locator (`page.locator('button')`, `page.getByRole('button')`, `page.getByTestId('submit')`) does NOT trigger any network or DOM calls.
- The `Locator` constructor formats combined selector queries (e.g. appending `>> internal:has-text=...` or `>> internal:role=button`).

### Auto-Waiting Mechanism
When an action method (e.g. `locator.click()`) is called, Playwright performs rigorous auto-waiting checks on the server side in `packages/playwright-core/src/server/dom.ts` inside `ElementHandle._retryPointerAction()` and `ElementHandle._performPointerAction()`:
1. **Attached & Visible Check**: Verifies element exists in DOM and is visible (`injected.checkElementStates` and `packages/injected/src/domUtils.ts` checking CSS display/visibility and non-zero bounding box; explicitly does *not* examine opacity, as detailed in Section 12.3).
2. **Enabled & Stable Check**: Verifies element is not disabled (`:disabled`) and is visually stable (bounding box does not shift across consecutive animation frames).
3. **Scroll into View**: Executes `doScrollIntoView()` / `scrollIntoViewIfNeeded` to bring element into the browser viewport.
4. **Hit Target Check**: Evaluates `injected.checkElementHitTarget()` at the action point `(x, y)` to ensure pointer events reach the target element and are not intercepted by overlay elements (e.g., sticky headers, modal backdrops).
5. **Action Execution**: Dispatches mouse/keyboard events (`Page.mouse.click`).
6. **Wait-After Action**: Optionally waits for pending network requests or navigation events initiated by the action (unless `noWaitAfter: true`).

---

## 4. End-to-End Action Call Trace (`Locator.click`)

Tracing `locator.click(options)` from public client API down to browser protocol layer:

```
[Public Client API] Locator.click(options)
  │ (packages/playwright-core/src/client/locator.ts)
  ▼
[Client Frame] Frame.click(this._selector, options)
  │ (packages/playwright-core/src/client/frame.ts)
  ▼
[Playwright Channel RPC] sends `click` payload over connection channel
  │
  ▼
[Server Dispatcher] FrameDispatcher.click(params, progress)
  │ (packages/playwright-core/src/server/dispatchers/frameDispatcher.ts)
  ▼
[Server Frame] Frame.click(progress, selector, options)
  │ (packages/playwright-core/src/server/frames.ts) -> invokes `_retryWithProgressIfNotConnected`
  ▼
[Server Selector & DOM] ElementHandle.click(progress, options) -> ElementHandle._click
  │ (packages/playwright-core/src/server/dom.ts)
  ▼
[Auto-Waiting & Retry] ElementHandle._retryPointerAction -> ElementHandle._performPointerAction
  │ checks attached, visible, enabled, stable, scrolls into view, hit target test
  ▼
[Server Input Device] Page.mouse.click(progress, point.x, point.y, options)
  │ (packages/playwright-core/src/server/input.ts) -> issues move, down, up calls
  ▼
[Browser Engine Protocol] CRSession / FFSession / WKSession
  │ (e.g., packages/playwright-core/src/server/chromium/crConnection.ts)
  ▼
[Browser Process] Dispatches CDP `Input.dispatchMouseEvent` / native OS event
```

---

## 5. Network Interception Architecture

### Client Routing API
- `page.route(url, handler)` / `context.route(url, handler)` in `packages/playwright-core/src/client/page.ts` & `browserContext.ts` registers `RouteHandler` entries.
- When network requests occur, matching route handlers receive a `Route` instance (`packages/playwright-core/src/client/network.ts`):
  - **`route.fulfill(options)`**: Intercepts request and responds with custom status, headers, and body (base64-encoded if binary). Calls `_channel.fulfill(...)`.
  - **`route.continue(options)`**: Modifies request URL, HTTP method, headers, or post data and resumes network fetch. Calls `_channel.continue(...)`.
  - **`route.abort(errorCode)`**: Cancels network request with error code (e.g. `'failed'`, `'aborted'`). Calls `_channel.abort(...)`.
  - **`route.fallback(options)`**: Passes control to the next matching route handler in chain.

### Server Network Engine
- `RouteDispatcher` in `packages/playwright-core/src/server/dispatchers/networkDispatchers.ts` processes channel commands.
- `Route` & `Request` in `packages/playwright-core/src/server/network.ts` manage browser protocol network interception hooks (`Fetch.enable` / `Network.setRequestInterception` in CDP).

---

## 6. Codegen / Recorder Architecture (Expanded Deep Dive)

Playwright's `codegen` (test generator) operates as a multi-tier pipeline connecting injected DOM event listeners, a server-side action recorder and debouncer, a standalone Vite-powered GUI window, score-based selector generators, and language code formatters.

```
[Web Page DOM (Injected Script)]
  │ Injected Recorder (packages/injected/src/recorder/recorder.ts) listens to click, input, keydown
  │ Computes optimal selector via SelectorGenerator (packages/injected/src/selectorGenerator.ts)
  ▼
[Exposed Binding IPC Bridge] window.__pw_recorderRecordAction(action)
  │ (packages/playwright-core/src/client/browserContext.ts & server/recorder.ts)
  ▼
[Server Recorder Controller] Recorder (packages/playwright-core/src/server/recorder.ts)
  │ Passes action to RecorderSignalProcessor (server/recorder/recorderSignalProcessor.ts)
  │ Emits RecorderEvent.ActionAdded to listeners
  ▼
[GUI Window & File Stream]
  ├── RecorderApp (packages/playwright-core/src/server/recorder/recorderApp.ts) -> Vite React UI (packages/recorder/src/recorder.tsx)
  └── ThrottledFile (packages/playwright-core/src/server/recorder/throttledFile.ts) -> streams generated code to disk (-o/--output)
  ▼
[Language Code Generators] (packages/isomorphic/codegen/)
  ├── JavaScriptLanguageGenerator (javascript.ts) -> Node.js / Playwright Test
  ├── PythonLanguageGenerator (python.ts) -> Pytest / Sync Library / Async Library
  ├── CSharpLanguageGenerator (csharp.ts) -> NUnit / MSTest / xUnit
  └── JavaLanguageGenerator (java.ts) -> JUnit / Library
```

---

### 6.1 Recorder Overlay, Toolbar UI, and Client-Server Bridge
- **GUI Window Launch (`RecorderApp`)**:
  - Located in `packages/playwright-core/src/server/recorder/recorderApp.ts` -> `RecorderApp.show(context, params)`.
  - Spawns a dedicated auxiliary browser window running a Vite React frontend app (`packages/recorder/src/recorder.tsx`).
  - Registers custom request interceptors for `https://playwright/` URLs to serve static Vite bundles (`libPath('vite', 'recorder')`).
- **Injected Overlay & Element Highlight**:
  - Injected script `Recorder` in `packages/injected/src/recorder/recorder.ts`:
    - Renders a highlight canvas box around elements when hovering in `inspecting` / `recording` mode (`HighlightModel` & `HighlightColors`).
    - Communicates overlay positioning adjustments to the server via exposed binding `window.__pw_recorderSetOverlayState()`.
- **IPC Binding Bridge**:
  - `Recorder` in `packages/playwright-core/src/server/recorder.ts` registers bindings into the browser execution context via `_context.exposeBinding()`:
    - `__pw_recorderState`: returns UI mode (`recording`, `inspecting`, `none`), active action point `(x, y)`, highlighted selector, and target test language.
    - `__pw_recorderRecordAction`: receives recorded `Action` payloads from injected DOM event listeners.
    - `__pw_recorderPerformAction`: allows the Recorder GUI to trigger actions in the page.
    - `__pw_recorderElementPicked`: fires when the user clicks an element in locator picker mode.

---

### 6.2 Storage State Capture (`--save-storage` and `--load-storage`)
- **CLI Flag Processing**:
  - `codegen(options, url)` in `packages/playwright-core/src/cli/browserActions.ts` parses `--save-storage=<path>` and `--load-storage=<path>`.
- **Session State Saving**:
  - Upon codegen exit or context closure, `launchContext()` in `cli/browserActions.ts` calls:
    ```js
    if (options.saveStorage)
      await context.storageState({ path: options.saveStorage });
    ```
  - `BrowserContext.storageState(options)` in `packages/playwright-core/src/client/browserContext.ts` issues a `_channel.storageState()` RPC call.
  - Server implementation `BrowserContext.storageState(progress, options)` in `packages/playwright-core/src/server/browserContext.ts` collects all cookies, origin security details, and `localStorage` key-value maps, serializing them to a JSON file.
- **Session State Loading**:
  - When `--load-storage=state.json` is passed, `launchContext()` initializes the context with `{ storageState: options.loadStorage }`, pre-populating cookies and `localStorage` so codegen starts in an authenticated state.

---

### 6.3 Multi-Language Code Generation (`--target`)
- **CLI Target Resolution**:
  - `codegenId()` in `packages/playwright-core/src/cli/program.ts` maps `--target` command line values (`playwright-test`, `javascript`, `python`, `python-pytest`, `python-async`, `csharp`, `csharp-nunit`, `java`, `java-junit`) to internal generator identifiers.
- **Generator Registry**:
  - `languageSet()` in `packages/isomorphic/codegen/languages.ts` instantiates and exports the set of available `LanguageGenerator` implementations:
    - `JavaScriptLanguageGenerator` (`packages/isomorphic/codegen/javascript.ts`): outputs Node.js `@playwright/test` or `playwright` library code.
    - `PythonLanguageGenerator` (`packages/isomorphic/codegen/python.ts`): outputs `pytest-playwright`, sync Python, or async Python (`asyncio`).
    - `CSharpLanguageGenerator` (`packages/isomorphic/codegen/csharp.ts`): outputs .NET code formatted for NUnit, MSTest, xUnit, or Library.
    - `JavaLanguageGenerator` (`packages/isomorphic/codegen/java.ts`): outputs Java code formatted for JUnit or Library.
    - `JsonlLanguageGenerator` (`packages/isomorphic/codegen/jsonl.ts`): outputs raw JSON lines for programmatic consumption.
- **Dynamic Language Switching**:
  - When the user selects a different target language in the Recorder GUI dropdown, `RecorderApp` calls `this._recorder.setLanguage(language.highlighter)` in `packages/playwright-core/src/server/recorder.ts`, which re-runs `generateCode()` over accumulated actions to dynamically re-render the preview.

---

### 6.4 Selector Generator Ranking Algorithm (`generateSelector`)
- **Core Function**: `generateSelector(targetElement, options)` in `packages/injected/src/selectorGenerator.ts`.
- **Heuristic Scoring System**:
  Playwright calculates candidate selector tokens and assigns numeric penalty scores (lower score = higher preference). The engine selects the token with the lowest score that uniquely resolves `targetElement`:

| Selector Type | Penalty Score | Example Generated Code |
| :--- | :--- | :--- |
| Custom Test ID | `kTestIdScore = 1` | `page.getByTestId('submit-btn')` |
| Secondary Test ID | `kOtherTestIdScore = 2` | `page.locator('[data-test="submit"]')` |
| ARIA Role + Accessible Name | `kRoleWithNameScore = 100` | `page.getByRole('button', { name: 'Submit' })` |
| Input Placeholder | `kPlaceholderScore = 120` | `page.getByPlaceholder('Enter email')` |
| Associated Label | `kLabelScore = 140` | `page.getByLabel('Password')` |
| Image Alt Text | `kAltTextScore = 160` | `page.getByAltText('Company Logo')` |
| Text Content | `kTextScore = 180` | `page.getByText('Learn more')` |
| Title Attribute | `kTitleScore = 200` | `page.getByTitle('Close modal')` |
| CSS / Tag / Class Fallback | `kEndPenalizedScore = 300` | `page.locator('div.container > button')` |

- **Custom Test ID Attribute Configuration**:
  Passing `--test-id-attribute=data-qa` updates `testIdAttributeName` in `SelectorGeneratorOptions`, allowing custom test attributes (e.g. `data-qa="login-btn"`) to be evaluated at `kTestIdScore = 1`.

---

### 6.5 Action Recording Lifecycle: Fresh Session vs. Attaching to Existing Context
- **Fresh Recording Session (`playwright codegen [url]`)**:
  - Function: `launchContext()` in `packages/playwright-core/src/cli/browserActions.ts`.
  - Spawns a brand-new browser process (`chromium.launch()`), creates a new `BrowserContext`, immediately invokes `context._enableRecorder()`, and opens `url` via `openPage(context, url)`.
- **Attaching to an Existing Context (e.g. `page.pause()` or programmatic `context._enableRecorder()`)**:
  - Function: `Recorder.forContext(context, params)` in `packages/playwright-core/src/server/recorder.ts`.
  - Detects existing active pages in `context.pages()` via `Recorder._onPage(page)` and subscribes to future pages (`context.on('page')`).
  - Extends injected script across all current and future document frames (`_context.extendInjectedScript(rawRecorderSource.source)`).
  - **Single-Page Isolation (`_pickLocatorPage`)**: When inspect mode is triggered on a specific page, `_pickLocatorPage` limits highlight overlay and locator picking to that page while leaving other open context pages operating normally.

---

### 6.6 Verification Sources & Documentation Alignment

| Feature / Behavior | Source Code File & Function | Confirmed via Playwright Official Docs |
| :--- | :--- | :--- |
| CLI `--target` flag options | `cli/program.ts` -> `codegenId()` | Confirmed (`https://playwright.dev/docs/codegen`) |
| `--save-storage` & `--load-storage` | `cli/browserActions.ts` -> `codegen()` | Confirmed (`https://playwright.dev/docs/codegen#preserve-authenticated-state`) |
| Custom `--test-id-attribute` | `injected/src/selectorGenerator.ts` | Confirmed (`https://playwright.dev/docs/locators#customize-test-id-attribute`) |
| Injected DOM Event Listening | `injected/src/recorder/recorder.ts` -> `Recorder` | Purely from Source |
| Action Debouncing (`RecorderSignalProcessor`) | `server/recorder/recorderSignalProcessor.ts` | Purely from Source |
| Multi-language Generator implementations | `isomorphic/codegen/javascript.ts`, `python.ts`, `csharp.ts`, `java.ts` | Purely from Source |

### 6.7 Programmatic Initiation and Termination Signals (`page.pause()`)

While the CLI launches a fresh session, programmatic control flows through `page.pause()` and resolves through a sophisticated dispatcher-interception layer.

1. **`page.pause()` -- The Real Programmatic Entry Point:**
   - **Client-Side Blocking:** In `packages/playwright-core/src/client/page.ts`, `page.pause()` temporarily zeroes out timeouts (`setDefaultNavigationTimeout(0)`) and directly awaits the channel message `this.context()._channel.pause({}, kNoTimeout)` within a `safeRace`. It does **not** natively launch the UI itself—it simply blocks until the server resolves the pause state.
   - **Server-Side Interception:** In `packages/playwright-core/src/server/dispatchers/browserContextDispatcher.ts`, the explicit `pause()` channel handler is empty (`// Debugger will take care of this.`). Instead, the global `Debugger` class (`packages/playwright-core/src/server/debugger.ts`) intercepts *all* calls via `onBeforeCall()`. When it detects a `BrowserContext.pause` method, it triggers `_pause()`, creating an unresolved promise (`_pausedCall`) that blocks the dispatcher from returning control to the client.
   - **Launching the App:** The act of pausing emits `Debugger.Events.PausedStateChanged`. The `BrowserContext` class (`packages/playwright-core/src/server/browserContext.ts`) listens to this event. If it detects a paused state, it triggers `RecorderApp.showInspectorNoReply(this)`. This executes `launchApp()` (`packages/playwright-core/src/server/recorder/recorderApp.ts`), which spawns an entirely *separate* and isolated Chromium browser context (`appContext`) specifically for the Inspector GUI, ensuring the inspected context is unpolluted.

2. **The "Resume" / "Close" Signal -- Unblocking the Script:**
   The `page.pause()` channel call remains permanently blocked until `Debugger.resume()` is invoked, which resolves the pending `_pausedCall` promise. The source handles this identically across two UI paths:
   - **"Resume" (Toolbar Button):** Resolves through an explicitly exposed binding named `__pw_resume` registered onto the inspected context in `packages/playwright-core/src/server/recorder.ts` (this is used by in-page overlays) OR via `doResume()` invoked through `sendCommand` from the Inspector UI (handled by `DebuggerDispatcher`). Both paths simply execute `this._debugger.resume()`.
   - **"Close" (Native Window Button):** Caught in `packages/playwright-core/src/server/recorder/recorderApp.ts` via `this._page.once('close', ...)`. The handler explicitly calls `this._recorder.close()` (which under the hood merely delegates to `this._debugger.resume()`).

3. **What happens to the browser/context after the signal fires?**
   - **Neither action closes the inspected script's browser or context.** The `page.pause()` promise resolves, and execution control returns immediately to the calling Node.js script. Subsequent lines of the test script continue perfectly normally against the same alive page.
   - **The only difference is the UI lifecycle:** Clicking "Resume" leaves the Recorder UI's isolated context alive in the background (ready to be paused again). Clicking the native window "Close" button explicitly tears down the Recorder's *own* isolated browser context (`this._page.browserContext.close()`), destroying the GUI.
---

## 7. @playwright/test Test Runner Architecture

The `@playwright/test` package provides the test runner framework built on top of `playwright-core`. It manages test file discovery, configuration parsing, fixture dependency injection, parallel worker process execution, auto-retrying assertions, and event reporting.

```
[CLI / Main Process]
  │ TaskRunner (packages/playwright/src/runner/tasks.ts)
  │  ├── collectProjectsAndTestFiles() (packages/playwright/src/runner/loadUtils.ts)
  │  ├── loadFileSuites() (packages/playwright/src/runner/loadUtils.ts) via LoaderHost
  │  └── createTestGroups() (packages/playwright/src/runner/testGroups.ts)
  ▼
[Dispatcher] (packages/playwright/src/runner/dispatcher.ts)
  │ Dispatches TestGroup payloads over IPC to worker processes
  ▼
[Worker Processes]
  │ WorkerHost (packages/playwright/src/runner/workerHost.ts) ──IPC── WorkerMain (packages/playwright/src/worker/workerMain.ts)
  │  ├── FixturePool (packages/playwright/src/common/fixtures.ts) -> Builds Fixture DAG
  │  ├── FixtureRunner (packages/playwright/src/worker/fixtureRunner.ts) -> Runs setup/use/teardown
  │  └── Expect & Auto-Retries (packages/playwright/src/matchers/expect.ts) -> pollAgainstDeadline()
  ▼
[Reporters]
  └── Multiplexer (packages/playwright/src/reporters/multiplexer.ts) -> broadcasts to List, Line, HTML, JSON reporters
```

---

### 7.1 Test Runner Core Loop: Discovery, Suite Building & Dispatch
- **Task Runner Pipeline**:
  - Entry point: `runTasks()` in `packages/playwright/src/runner/tasks.ts`.
  - Executes sequential setup, test run, and cleanup tasks using `TaskRunner<TestRun>` (`packages/playwright/src/runner/taskRunner.ts`).
- **Spec File Discovery**:
  - `collectProjectsAndTestFiles()` in `packages/playwright/src/runner/loadUtils.ts`:
    - Iterates over filtered projects in `TestRun.filteredProjects`.
    - Invokes `collectFilesForProject()` in `packages/playwright/src/runner/projectUtils.ts` using glob matching (`testMatch`, `testIgnore`).
- **Spec File Loading & Transformation**:
  - `loadFileSuites()` in `packages/playwright/src/runner/loadUtils.ts`:
    - Uses `InProcessLoaderHost` or `OutOfProcessLoaderHost` (`packages/playwright/src/runner/loaderHost.ts`).
    - Uses Playwright's custom transpiler (`packages/playwright/src/transform/transform.ts`) to compile ESM/TypeScript files on the fly.
- **Suite Tree & Test Grouping**:
  - `createRootSuite()` in `loadUtils.ts` constructs the root `Suite` containing project suites and test file suites.
  - `createTestGroups()` in `packages/playwright/src/runner/testGroups.ts` partitions tests into `TestGroup` bundles based on `workerHash`, shard settings, and `repeatEachIndex`.
- **Dispatcher**:
  - `Dispatcher` in `packages/playwright/src/runner/dispatcher.ts` maintains worker pool slots and dispatches `TestGroup` payloads over IPC to child worker processes.

---

### 7.2 Fixtures System (`test.extend()`, Scoping, and Dependency DAG)
- **Fixture Registration**:
  - `test.extend()` registers fixture definitions in `FixturePool` (`packages/playwright/src/common/fixtures.ts`).
  - Each fixture is represented as a `FixtureRegistration` containing fixture `name`, `scope` (`'test'` or `'worker'`), `fn` (the generator function), and `deps` (array of dependency names parsed from the function parameters `({ page, db }, use) => ...`).
- **Fixture Scoping**:
  - **`scope: 'worker'`**: Created once per worker process. Reused across all tests executed within that worker process (e.g. database connections, browser server instances).
  - **`scope: 'test'`** (default): Created fresh before each test and torn down immediately after (e.g. `page`, `context`, custom test state).
- **Dependency DAG & Execution**:
  - `FixtureRunner` in `packages/playwright/src/worker/fixtureRunner.ts` resolves dependencies in topological order:
    1. **Setup**: Evaluates leaf fixtures first, calling fixture functions up to `await use(value)`. The yielded value is passed to downstream dependent fixtures and finally to the test body.
    2. **Execution**: The test body runs with the resolved fixture values.
    3. **Teardown**: Runs in reverse topological order (root to leaves) after the test completes, resuming execution after `use(value)` to run cleanup logic.

---

### 7.3 Worker Process Architecture & Test Isolation
- **Process Spawning**:
  - `WorkerHost` in `packages/playwright/src/runner/workerHost.ts` extends `ProcessHost` (`packages/playwright/src/runner/processHost.ts`).
  - Spawns isolated Node.js child processes via `child_process.fork()` executing the generated `packages/playwright/src/worker/workerProcessEntry.js` (compiled from the checked-in TypeScript source `packages/playwright/src/worker/workerProcessEntry.ts`).
- **Process Communication**:
  - Main process and worker process communicate using structured IPC messages (`packages/playwright/src/common/ipc.ts`).
  - `WorkerMain` in `packages/playwright/src/worker/workerMain.ts` receives `runTestGroup` IPC commands from `WorkerHost`.
- **Test Isolation Boundary**:
  - Each worker process runs in an isolated OS process with distinct global memory, `process.env` overrides (`TEST_WORKER_INDEX`, `TEST_PARALLEL_INDEX`), and output artifact folders.
  - Test-scoped browser contexts and pages are destroyed between tests, preventing state pollution.
- **Reporting Results & Errors**:
  - Worker streams live stdio chunks (`stdOut`, `stdErr`) and test execution hooks (`testBegin`, `testEnd`, `stepBegin`, `stepEnd`) back to `WorkerHost`, which delegates them to the main runner's `InternalReporter`.

---

### 7.4 Auto-Retrying Assertions (`expect(locator).toBeVisible()`)
- **Expect Core & Async Matchers**:
  - Implemented in `packages/playwright/src/matchers/expect.ts` & `packages/playwright/src/matchers/matchers.ts`.
  - Custom web matchers (`toBeVisible`, `toBeAttached`, `toBeChecked`, `toBeEnabled`, `toHaveText`, `toHaveURL`, etc.) are registered in `customAsyncMatchers`.
- **Polling & Retry Loop**:
  - Unlike synchronous one-shot assertions (e.g. `expect(value).toBe(5)` which fail immediately on mismatch), web assertions call `pollAgainstDeadline()` from `@isomorphic/timeoutRunner`.
  - The matcher repeatedly queries the server element state (e.g. checking visibility or text content) until either:
    1. The expected condition evaluates to `true` (assertion passes).
    2. The assertion timeout deadline is reached, throwing an `ExpectError` with a formatted diff and stack trace.
- **Soft Assertions**:
  - `expect.soft()` sets `info.isSoft = true` in `callMatcherAsStep()`. On failure, the step catches the `ExpectError` and appends it to `TestInfoImpl._errors` without aborting remaining test execution.

---

### 7.5 Reporters & Event Multiplexing
- **Reporter V2 Interface**:
  - Defined in `packages/playwright/src/reporters/reporterV2.ts` (`ReporterV2`).
  - Specifies lifecycle event callbacks:
    - `onConfigure(config)`: config initialization.
    - `onBegin(suite)`: test run start with full suite tree.
    - `onTestBegin(test, result)`: individual test start.
    - `onStepBegin(test, result, step)` / `onStepEnd(test, result, step)`: test step progress.
    - `onTestEnd(test, result)`: individual test completion (passed, failed, timedOut, skipped).
    - `onEnd(result)`: test run completion with final status summary.
    - `onStdOut(chunk, test, result)` / `onStdErr(chunk, test, result)`: console output.
- **Event Multiplexer**:
  - Implemented in `packages/playwright/src/reporters/multiplexer.ts` (`Multiplexer`).
  - Acts as a fan-out router, broadcasting every runner event to all configured reporters simultaneously.
- **Built-in Reporters**:
  - `ListReporter` (`packages/playwright/src/reporters/list.ts`): renders real-time terminal output with progress indicators.
  - `LineReporter` (`packages/playwright/src/reporters/line.ts`): single-line terminal progress updates.
  - `DotReporter` (`packages/playwright/src/reporters/dot.ts`): concise dot output.
  - `HTMLReporter` (`packages/playwright/src/reporters/html.ts`): builds interactive HTML report bundle.
  - `JSONReporter` (`packages/playwright/src/reporters/json.ts`): writes structured JSON test result tree.

---

## 8. Tracing, Trace Viewer, and Cross-Origin Frame Architecture

### 8.1 Tracing Recording Architecture (`context.tracing.start()` / `stop()`)
- **Client Entry Point**:
  - `Tracing` class in `packages/playwright-core/src/client/tracing.ts`.
  - Methods: `start()`, `startChunk()`, `stopChunk()`, `stop({ path })`.
  - Sends `tracingStart`, `tracingStartChunk`, `tracingStop` RPC requests over `TracingChannel` to server `TracingDispatcher` (`packages/playwright-core/src/server/dispatchers/tracingDispatcher.ts`).
- **Server Trace Recorder**:
  - `Tracing` class in `packages/playwright-core/src/server/trace/recorder/tracing.ts`.
  - Implements `InstrumentationListener`, `SnapshotterDelegate`, and `HarTracerDelegate`.
  - Attaches `Snapshotter` (`packages/playwright-core/src/server/trace/recorder/snapshotter.ts`) for DOM snapshotting (`snapshotterInjected.ts`), `HarTracer` for HTTP request/response capturing, and screencast frame recorders per page.

---

### 8.2 Trace Archive Zip Structure
When `context.tracing.stop({ path: 'trace.zip' })` is executed, `Tracing.stopChunk()` packages captured data into a compressed `.zip` archive containing:

```
trace.zip
├── trace.trace         # JSON lines: API call events, durations, stack traces, console messages, page events
├── trace.network       # JSON lines: HAR network request/response headers, timings, status codes, payload hashes
└── resources/          # Content-addressed storage (SHA1 filename keys)
    ├── <sha1>.html     # Page DOM HTML snapshots
    ├── <sha1>.jpeg     # Screencast viewport frame images
    ├── <sha1>.png      # Action point screenshot overlays
    └── <sha1>.bin      # Network response binary bodies (CSS, JS, fonts, images)
```

---

### 8.3 Trace Viewer Architecture
- **Web App & Standalone Viewer**:
  - `startTraceViewerServer()` in `packages/playwright-core/src/server/trace/viewer/traceViewer.ts`:
    - Spawns an internal `HttpServer` serving the Vite React web application from `packages/trace-viewer/` (`libPath('vite', 'traceViewer')`).
    - Exposes endpoints `/file?path=...` to serve trace files (`trace.trace`, `trace.network`) and SHA1 resources to the browser UI.
- **Trace Viewer UI Parsing**:
  - Front-end React UI (`packages/trace-viewer/src/ui/workbench.tsx`) and isomorphic model (`packages/isomorphic/trace/traceModel.ts`, exposed to the UI via `packages/trace-viewer/src/ui/traceModelContext.tsx` hook):
    - Parses `trace.trace` and `trace.network` to construct a unified interactive timeline.
    - `SnapshotServer` & `SnapshotViewer` iframe reconstruct full DOM snapshots at exact pre-action and post-action timestamps without running a live browser.

---

### 8.4 Frame Hierarchy & Ownership
- **Client Frame**: `Frame` class in `packages/playwright-core/src/client/frame.ts`.
  - Linked to parent `Page` (`_page: Page`).
  - Navigating or querying elements in child frames uses `frame.childFrames()`, `frame.parentFrame()`, or `page.frameLocator(selector)`.
- **Server Frame Tree**: `Frame` & `FrameManager` classes in `packages/playwright-core/src/server/frames.ts`.
  - `Page` owns a `FrameManager` instance which maintains the frame tree (`_mainFrame` and `_childFrames: Set<Frame>`).
  - Dispatches frame lifecycle events (`Page.Events.FrameAttached`, `FrameNavigated`, `FrameDetached`).

---

### 8.5 Cross-Origin IFrames & OOPIF Architecture
- **Chromium Out-Of-Process IFrames (OOPIF)**:
  - Chromium isolates cross-origin iframes into separate renderer processes (OOPIF).
  - Implemented in `packages/playwright-core/src/server/chromium/crPage.ts` inside `_onAttachedToTarget()`.
- **Target Auto-Attach & Child CDP Sessions**:
  - Playwright configures Chromium target manager with `Target.setAutoAttach({ autoAttach: true, flatten: true })`.
  - When a cross-origin iframe is created or navigated, Chrome fires `Target.attachedToTarget` with `targetInfo.type === 'iframe'`.
  - `crPage.ts` creates a child CDP session (`session = this._client.createChildSession(event.sessionId)`) and wraps it in a `FrameSession`.
  - Protocol commands directed at elements inside the OOPIF are automatically routed through the child CDP session to the correct renderer process, while `FrameManager` presents a single, unified `Frame` tree to the user.

---

### 8.6 Frame Lifecycle & Navigation Event Propagation

```
[Browser Renderer / Target Session]
  │ Fires CDP Page.frameAttached, Page.frameNavigated, Page.frameDetached (or Target.attachedToTarget for OOPIF)
  ▼
[Server CRPage / FrameManager] (packages/playwright-core/src/server/frames.ts & server/chromium/crPage.ts)
  │ Updates internal frame tree (_mainFrame, _childFrames)
  │ Dispatches Page.Events.FrameAttached, FrameNavigated, FrameDetached
  ▼
[Server FrameDispatcher] (packages/playwright-core/src/server/dispatchers/frameDispatcher.ts)
  │ Emits RPC channel events: `navigated`, `loadstate` over FrameChannel
  ▼
[Client Page & Frame] (packages/playwright-core/src/client/page.ts & client/frame.ts)
  │ Updates client Frame properties (url, name)
  │ Fires public Page events: `page.on('frameattached')`, `page.on('framenavigated')`, `page.on('framedetached')`
```

---

## 9. Downloads, API Testing, and Time Mocking

### 9.1 Downloads, Uploads, and Dialog Handling
- **Downloads**:
  - Emits `Page.Events.Download` natively via `packages/playwright-core/src/server/download.ts` (`Download` class) and `packages/playwright-core/src/server/artifact.ts` (`Artifact` class).
  - Chromium listens for `Browser.downloadWillBegin` and `Browser.downloadProgress` in `packages/playwright-core/src/server/chromium/crBrowser.ts`.
- **Uploads (`setInputFiles`)**:
  - Calling `page.setInputFiles()` flows through `packages/playwright-core/src/server/dom.ts` (`_setInputFiles`), calling `_page.delegate.setInputFilePaths`.
  - Chromium implementation (`packages/playwright-core/src/server/chromium/crPage.ts`) pushes files directly via `DOM.setFileInputFiles` CDP command.
- **Dialogs & File Choosers (`page.on('dialog')` / `page.on('filechooser')`)**:
  - File chooser interception is enabled via `Page.setInterceptFileChooserDialog` CDP command; Chromium (`crPage.ts`) captures `Page.fileChooserOpened` and wraps it in a `FileChooser` (`packages/playwright-core/src/server/fileChooser.ts`).
  - Native dialogs (alert/confirm/prompt) trigger `Page.javascriptDialogOpening` in `crPage.ts`, creating a `Dialog` object (`packages/playwright-core/src/server/dialog.ts`). Actions on the dialog send `Page.handleJavaScriptDialog`.

### 9.2 API Testing (`APIRequestContext`)
- **Location**: Defined in `packages/playwright-core/src/server/fetch.ts` (`APIRequestContext`) and `packages/playwright-core/src/client/fetch.ts`.
- **Network Stack Independence**: Instead of routing through the browser's CDP network stack, `APIRequestContext` utilizes Node.js native `http`/`https` modules (`http.request` / `https.request` in `fetch.ts`) directly.
- **Cookie & Storage Sharing**: Subclasses like `BrowserContextAPIRequestContext` (`server/fetch.ts`) override `addCookies`, `cookies`, and `storageState` to directly call methods on the underlying `BrowserContext`, seamlessly sharing the authentication state between Node.js API requests and browser-driven CDP requests.

### 9.3 Clock & Time Mocking
- **Location**: `packages/playwright-core/src/server/clock.ts`.
- **Mechanism**: The `Clock` class manages time by reading a raw mock implementation (`rawClockSource.source`, likely based on SinonJS) and injecting it into the page via `_browserContext.addInitScript()`.
- **Execution**: Methods like `clock.install()`, `clock.pauseAt()`, and `clock.fastForward()` trigger `_evaluateInFrames('globalThis.__pwClock.controller...')` in the page, completely faking `Date` and `setTimeout` entirely within the JavaScript environment.

---

## 10. Page Load Detection and Multi-Tab Architecture

### 10.1 Page Load Detection -- Visual Readiness vs. Data Readiness
- **Lifecycle Events**: Tracked via `this._firedLifecycleEvents` in `packages/playwright-core/src/server/frames.ts`. `page.waitForLoadState(state)` awaits the `Frame.Events.AddLifecycle` event if the state isn't already reached.
- **The `networkidle` Algorithm**:
  - Tracked via `_inflightRequests` in `packages/playwright-core/src/server/frames.ts`.
  - When the last in-flight request finishes (`_inflightRequests.size === 0`), `_startNetworkIdleTimer()` schedules a `setTimeout` for exactly `500` ms.
  - If a new request begins (`_inflightRequestStarted`), `_stopNetworkIdleTimer()` clears the timer. Thus, `networkidle` strictly requires zero active network connections for 500 milliseconds.
- **Visual Stability**:
  - Playwright's `page.screenshot()` handles visual stability natively. In `packages/playwright-core/src/server/screenshotter.ts`, `_preparePageForScreenshot` disables animations (if requested) via injected CSS, and actively waits for fonts to settle using `frame.nonStallingEvaluateInExistingContext('document.fonts.ready', 'utility')` unless explicitly skipped by an environment variable.
- **Data Readiness**:
  - While lifecycle events apply to the whole frame, `page.waitForResponse()` and `page.waitForRequestFinished()` (in `packages/playwright-core/src/client/page.ts`) delegate directly to the underlying `EventEmitter` tracking individual CDP network payloads (e.g. `Events.Page.Response`). These are completely decoupled from `networkidle` or `load` events.

### 10.2 Multi-Tab / Multi-Page Switching Logic
- **New Tab Creation**:
  - Popups and new tabs trigger Chromium's `Target.attachedToTarget` event, caught in `packages/playwright-core/src/server/chromium/crBrowser.ts` (`_onAttachedToTarget`).
  - If `targetInfo.type === 'page'`, it initializes a new `CRPage`, sets the `opener` using `targetInfo.openerId`, and fires `this._page.reportAsNew(this._opener?._page)`, which propagates the `context.on('page')` event.
- **`page.bringToFront()`**:
  - Implemented in `packages/playwright-core/src/server/chromium/crPage.ts` (`bringToFront`). It sends the `Page.bringToFront` CDP command directly to the tab's session (not `Target.activateTarget`).
- **Context & Page Inventory**:
  - `browser.contexts()` simply returns the internal `_contexts` array.
  - `context.pages()` (in `packages/playwright-core/src/server/browserContext.ts`) filters the `_crPages` Map kept by `CRBrowser`. There is no global registry; targets are just tracked locally in memory as they attach/detach.
- **"Active" Tab Concept**:
  - Playwright does *not* utilize a single "active tab" concept for automation. Because every `CRPage` holds its own direct CDP child session (`CRSession`), scripts can interact with any `Page` concurrently. `bringToFront()` is purely for human visual inspection or triggering visibility-based DOM events (like `requestAnimationFrame`), but is not required to issue CDP commands.

## 11. Deterministic Readiness Patterns for Dynamic UI Elements (Dropdowns & Beyond)

*Note: The following are ENGINEERED PATTERNS composed from real Playwright APIs to address real-world unreliability with global heuristic checks like `networkidle`. They are not built-in Playwright methods.*

### 11.1 Targeted Network Interception ("wait for the one response that matters")
- **Mechanism**: Instead of waiting for all network traffic to cease (`networkidle`), you wait for a specific HTTP response indicating that the specific data you need has arrived.
- **API**: `page.waitForResponse(urlOrPredicate, options)` in `packages/playwright-core/src/client/page.ts`.
- **Default Timeout**: By default, it uses the global timeout setting, which falls back to `DEFAULT_PLAYWRIGHT_TIMEOUT` defined as `30_000` (30 seconds) in `packages/isomorphic/time.ts`.

### 11.2 Browser-Side Predicate Polling ("wait for the DOM to say so")
- **Mechanism**: Executing a JavaScript function inside the browser repeatedly until it returns a truthy value, confirming that the DOM has reached the desired state (e.g., a dropdown is populated).
- **API**: `page.waitForFunction(pageFunction, arg, options)` in `packages/playwright-core/src/client/page.ts`.
- **Default Polling Strategy**: Tracing `_mainFrame.waitForFunction` down to `packages/playwright-core/src/server/frames.ts` (inside `waitForFunctionExpression`), the default polling strategy when `polling` is not specified (or explicitly set to `'raf'`) utilizes `requestAnimationFrame(next)` inside the browser. If a numeric value is passed, it uses `setTimeout(next, polling)`.

### 11.3 Network Stubbing / Mocking ("skip the network entirely")
- **Mechanism**: Preempting the network request entirely by stubbing the response, providing immediate mocked data for UI components.
- **API**: `page.route(url, handler)` and `route.fulfill(response)` (implemented in `packages/playwright-core/src/server/chromium/crNetworkManager.ts`).
- **Internal Behavior**: Calling `route.fulfill()` sends the CDP command `Fetch.fulfillRequest` directly to the Chromium session. This explicitly short-circuits the request at the browser level—the request *never reaches the physical network layer* and instead Playwright directly injects the mocked HTTP response into the browser over the CDP websocket.

### 11.4 "Click and Retry" Loop (brute-force fallback)
- **Mechanism**: Wrapping an interaction in a manual `try/catch` block that retries after a short delay (e.g., a chosen 100ms) if it throws an error.
- **Comparison to Built-in Retries**: Playwright's `locator.click()` automatically utilizes `_retryPointerAction()` (in `packages/playwright-core/src/server/dom.ts`) to poll for standard actionability checks (visible, stable, enabled, receives events).
- **What this adds**: A manual retry loop catches *application-level* rejections or custom `evaluate()` failures that bypass or fool Playwright's structural actionability checks. For example, if an element is technically "actionable" but clicking it causes the app to throw an error because internal app state isn't ready, or if you use `.click({ force: true })` on a non-standard element, a manual loop allows you to recover from those arbitrary JavaScript/DOM exceptions.

## 12. Video Recording Architecture (`recordVideo`) and Its Hard Constraints

### 12.1 FFmpeg Encoding Pipeline
- **Binary Sourcing**: Tracing `packages/playwright-core/src/server/videoRecorder.ts` confirms it spawns a physical `ffmpeg` child process via `registry.findExecutable('ffmpeg')!.executablePathOrDie(...)`.
- **FFmpeg Arguments**: The `FfmpegVideoRecorder` class hardcodes the encoding parameters:
  - **Codec**: `vp8` (`-c:v vp8`)
  - **Quality**: `-qmin 0 -qmax 50 -crf 8` (constant quality mode)
  - **Speed**: `-deadline realtime -speed 8`
  - **Bitrate**: `-b:v 1M`
  - **Audio**: Excluded entirely via `-an`. Playwright videos are purely visual.
  - **Framerate**: `-r 25`, driven by a hardcoded `const fps = 25;` at the top of the file. It is not exposed for configuration.
  - **Threads**: `-threads 1` to reduce CPU stalling.
- **Default Dimensions**: If `recordVideo.size` is unspecified, `Screencast.addClient` in `packages/playwright-core/src/server/screencast.ts` falls back to the context's viewport size. If no viewport is defined, it defaults to `{ width: 800, height: 600 }`, scales it to fit within an 800px bounding box, and forcefully rounds down to even numbers (`& ~1`) to satisfy `vp8` requirements.

### 12.2 Default Environmental Settings
- **Viewport**: Confirmed in `packages/playwright-core/src/server/browserContext.ts` (`validateBrowserContextOptions`): `options.viewport` defaults to `{ width: 1280, height: 720 }`.
- **Device Scale Factor**: Confirmed in `packages/playwright-core/src/server/chromium/crPage.ts` (`deviceScaleFactor: options.deviceScaleFactor || 1`).
- **Timezone & Locale**: In `packages/playwright-core/src/server/browserContext.ts`, `locale` explicitly defaults to `'en-US'`. However, `timezoneId` has no default fallback in Playwright's configuration object; if omitted, Playwright simply does not send the `Emulation.setTimezoneOverride` CDP command, leaving the browser to inherit the host operating system's timezone natively.

### 12.3 Auto-Waiting "Stable" Check Scope
- **Scope limitation**: Verified `_checkElementIsStable()` in `packages/injected/src/injectedScript.ts`. The check strictly compares `getBoundingClientRect()` values across multiple `requestAnimationFrame` ticks.
- **Implication**: It does *not* read `opacity`, `visibility`, or computed style transitions. A CSS fade-in animation that doesn't shift layout coordinates is immediately deemed "stable", meaning Playwright might execute a click while the element is completely transparent.

### 12.4 Cursor Visibility in Recorded Video
- **Mechanism**: The `FfmpegVideoRecorder` simply ingests MJPEG frames emitted by the page.
- **Cursor Absence**: Playwright actions (`page.click`) dispatch synthetic CDP `Input.dispatchMouseEvent` events rather than moving the OS-level pointer. Because the OS pointer isn't moving over the viewport, no cursor is naturally rendered.
- **Screencast Overlay**: While `packages/playwright-core/src/server/screencast.ts` does contain cursor rendering logic (injecting a fake DOM overlay via `injected.setScreencastAnnotation`), this is used explicitly when `recordVideo.showActions` is true (e.g. for Inspector/Codegen/Traces). Normal video recordings lack this overlay.

### 12.5 `navigator.webdriver` / Automation Detection Surface
- **Missing Flag**: A complete read of `_innerDefaultArgs()` (in `packages/playwright-core/src/server/chromium/chromium.ts`) and `chromiumSwitches()` (in `packages/playwright-core/src/server/chromium/chromiumSwitches.ts`) definitively proves that `--enable-automation` is NEVER added by Playwright's TypeScript source.
- **Implication**: Because Playwright never actually pushes `--enable-automation` into the Chromium arguments array to begin with, passing `ignoreDefaultArgs: ['--enable-automation']` is a syntactically valid but functionally inert no-op. It attempts to filter a flag that was never in the defaults list, meaning it is not a real evasion technique.

---

## 13. Custom Engines, Emulation, Observability, and Automation Detection Surface

### 13.1 Custom Selector Engines
- **Mechanism**: `selectors.register(name, script)` (verified in `packages/playwright-core/src/client/selectors.ts`) injects a JavaScript module into the page.
- **Implementation**: The injected script object must expose at least a `query(root, selector)` function (returning an `Element` or `undefined`) and a `queryAll(root, selector)` function (returning an `Element[]`). Once registered, it can be invoked via `page.locator('name=value')`.

### 13.2 `slowMo` Launch Option
- **Scope and Unit**: Verified as a top-level `BrowserType.launch()` option (`options.slowMo`) defined in milliseconds.
- **Pipeline Insertion**: Traced to `packages/playwright-core/src/server/dispatchers/dispatcher.ts` (inside `_doSlowMo`). After an action completes (in the `finally` block of the dispatcher), it literally calls `await new Promise(f => setTimeout(f, slowMo))`, globally throttling every individual CDP command response dispatched back to the client.

### 13.3 Device Emulation Scope
- **Level of Enforcement**: Emulation options like `viewport`, `geolocation`, `offline`, and `userAgent` are bound strictly to the `BrowserContext` level.
- **Verification**: Confirmed via the `BrowserContextOptions` interface within `packages/playwright-core/types/types.d.ts`, which defines these properties globally for the context, meaning they apply uniformly to all Pages within that context rather than being set per-page or per-browser-instance.

### 13.4 Visual Regression -- Masking & Animation Freezing
- **Masking Scope**: Verified in `packages/playwright/src/matchers/toMatchSnapshot.ts` that the `mask` option legitimately accepts an `Array<Locator>`, allowing targeted blocking of dynamic regions.
- **Animation Freezing**: Verified that `toHaveScreenshot` defaults to `animations: 'disabled'`, which propagates directly to `page._expectScreenshot`. It reuses the exact same CSS-freezing mechanism (`*, *::before, *::after { transition: none... }`) built into the standard `locator.screenshot()` CDP pipeline; it does not implement a separate freezing logic.

### 13.5 Accessibility Tree Access
- **No Direct API**: A comprehensive search of the Playwright source and type definitions confirms that unlike Puppeteer, Playwright does *not* provide a native `page.accessibility.snapshot()` API. Accessibility is handled exclusively via DOM traversal (`.getByRole()`) or externally via `@axe-core/playwright`.

### 13.6 Worker / Service Worker / WebSocket Hooks
- **Worker**: `page.on('worker')` (verified in `packages/playwright-core/src/client/page.ts`) exposes a `Worker` instance (from `client/worker.ts`) representing a Web Worker.
- **Service Worker**: `context.serviceWorkers()` (verified in `packages/playwright-core/src/client/browserContext.ts`) returns an array of `Worker` instances (`Worker[]`).
- **WebSocket**: `page.on('websocket')` exposes a `WebSocket` instance (imported from `client/network.ts`), triggered by the underlying `webSocketRoute` internal CDP bindings.

### 13.7 Low-Level CDP Session Access
- **Capabilities**: `context.newCDPSession(page)` returns a `CDPSession` that bypasses Playwright's high-level abstractions.
- **Verification**: Verified in `packages/playwright-core/src/server/chromium/protocol.d.ts` that raw domains like `Emulation.setCPUThrottlingRate` and `Network.emulateNetworkConditions` (though the latter notes deprecation in favor of `Network.emulateNetworkConditionsByRule`) are formally supported by the protocol bindings, allowing advanced manipulations like CPU throttling.

### 13.8 Code Coverage
- **Mechanism**: Verified in `packages/playwright-core/src/server/chromium/crCoverage.ts` (and exposed via `packages/playwright-core/src/client/coverage.ts`).
- **API Surface**: It exposes `page.coverage.startJSCoverage()`, `stopJSCoverage()`, `startCSSCoverage()`, and `stopCSSCoverage()`. It is a Chromium-only feature backed directly by V8's native profiling capabilities.

### 13.9 Automation Detection Surface -- Correction Pass
- **Mechanics of Early Execution**: `page.addInitScript()` evaluates before the page's own scripts run because it leverages the native CDP command `Page.addScriptToEvaluateOnNewDocument` (verified in `packages/playwright-core/src/server/chromium/crPage.ts` via `_evaluateOnNewDocument`).
- **Impact**: Because V8 invokes this command upon a new document instantiation before the DOM is populated, it provides a mechanism for overriding `navigator.webdriver` or deleting fingerprint-able properties before client-side scripts run.
- **Definitive Finding on `--enable-automation`**: Passing `ignoreDefaultArgs: ['--enable-automation']` does absolutely nothing. An exhaustive verification of `chromium.ts` (`_innerDefaultArgs`) and `chromiumSwitches.ts` (`chromiumSwitches`) confirms the string `--enable-automation` is never added to the default arguments array in this version of Playwright. Filtering it is a strict no-op.

---

## 14. Multi-Tab Recording: Video Fragmentation vs. Tracing Correlation

### 14.1 `recordVideo` Produces Independent, Uncorrelated Files Per Tab
- **Mechanism**: Re-verifying `startAutomaticVideoRecording(page)` in `packages/playwright-core/src/server/videoRecorder.ts` (lines 87-97) confirms that video recording is instantiated strictly on a per-page basis. It reads the context-level `recordVideo` configuration but actively spawns an independent `VideoRecorder` for the current page.
- **File Output**: The output filename is hardcoded as `path.join(dir, page.guid + '.webm')`. Consequently, every page/tab inside a configured context automatically yields its own strictly separate `.webm` file named after the tab's `guid`.
- **Complete Fragmentation**: There is no code within `videoRecorder.ts` that writes cross-referencing metadata (such as an opener page ID, a shared timeline, or any synchronized metadata artifact) into the video or its filename.
- **Practical Implication**: If a user flow involves opening a link in a new tab, manipulating state, closing it, and returning to the original tab, Playwright generates *two separate video files*. Because the videos lack synchronized timelines, it is impossible to deterministically reconstruct from the `.webm` files alone precisely when the tab switch occurred or which tab initiated the other.

### 14.2 `context.tracing` Is the Actual Cross-Tab Correlation Mechanism
- **Context-Level Scope**: In contrast to video recordings, `packages/playwright-core/src/server/browserContext.ts` instantiates a single `Tracing` instance (`this.tracing = new Tracing(...)`) bound to the entire BrowserContext. A single trace archive encapsulates every tab.
- **Event Relationships**: `packages/playwright-core/src/server/trace/recorder/tracing.ts` handles lifecycle events across all pages in the context.
  - `onPageOpen` emits an event containing `{ pageId: page.guid, openerPageId: page.opener()?.guid }`.
  - `onPageClose` emits an event with `method: 'pageClosed'` and `{ pageId: page.guid }`.
- **Monotonic Clock**: These events are stamped with `monotonicTime()`. Tracing `packages/isomorphic/time.ts` (lines 35-37) confirms this relies on `performance.now()` (plus a localized shift). This is a process-relative clock, not an epoch wall-clock. Because the entire Node.js context shares this single time origin, it provides consistent process-level sequencing.
- **Practical Implication**: `openerPageId` is the definitive field that answers "which tab opened this tab". When combined with the shared `monotonicTime()` clock tying together actions and lifecycle events, `context.tracing` allows precise correlation of multi-tab flows, a capability fundamentally absent from raw video recordings.

---

## 15. Unverified Claims & Caveats

- **Unverified (No Runtime Execution)**: As mandated by task constraints, no `npm install`, browser binary downloads, or script execution were performed. All findings are derived strictly from inspecting TypeScript source files in `upstream/playwright` and cross-referencing official documentation.
- **Unverified (Browser Binary Protocol Messages)**: Low-level C++ browser binary internal handling of CDP/RDP packets beyond Playwright's TypeScript transport layer (`CRConnection`, `FFConnection`, `WKConnection`) is unverified as engine source code is outside this repository.
