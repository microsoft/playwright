# Playwright Bug: CDP Session Not Reconnected After Extension Reload

> This file is intended for an agent working on the Playwright source code.
> It contains everything needed to reproduce, understand, and fix the issue.

## Summary

When a Chrome extension reloads inside a Playwright persistent context
(via `chrome.runtime.reload()`, `chrome://extensions/` UI, or any other
method), Playwright's CDP session management does not reconnect to the
new extension contexts. All subsequent navigation to `chrome-extension://`
pages fails with `net::ERR_BLOCKED_BY_CLIENT`, the old service worker
reference throws `TargetClosedError`, and no new `serviceworker` event
fires on the context.

This works correctly in a regular (non-Playwright) Chrome session.
The bug is in Playwright's CDP context tracking, not in Chrome itself.

## Affected versions

- Playwright 1.58.0 (Python), Chromium 145.0.7632.0
- Also confirmed in earlier versions back to Playwright 1.51 / Chromium 134
- Worked correctly in Playwright 1.50.0 / Chromium 133

## Reproduction

### Minimal script (no test framework needed)

```python
import time
from playwright.sync_api import sync_playwright

# Requires a Chrome MV3 extension with:
#   - A service worker (background.js)
#   - A testing.html page with a button that calls
#     chrome.runtime.sendMessage({type: "ReloadExtension"})
#   - A background handler: chrome.runtime.reload()
EXTENSION_PATH = "./dist"

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        user_data_dir="",
        channel="chromium",
        headless=False,
        args=[
            "--headless=new",
            f"--disable-extensions-except={EXTENSION_PATH}",
            f"--load-extension={EXTENSION_PATH}",
        ],
    )
    if not ctx.service_workers:
        ctx.wait_for_event("serviceworker")
    time.sleep(2)

    ext_id = ctx.service_workers[0].url.split("/")[2]
    print(f"Extension ID: {ext_id}")

    # Step 1: verify extension page works before reload
    page = ctx.new_page()
    page.goto(f"chrome-extension://{ext_id}/popup.html")
    print("BEFORE reload: extension page loads OK")
    page.close()

    # Step 2: reload via chrome://extensions/ UI
    ext_page = ctx.new_page()
    ext_page.goto("chrome://extensions/")
    time.sleep(1)
    reload_btn = (ext_page.locator("extensions-manager")
                  .locator("extensions-item-list")
                  .locator(f"extensions-item#{ext_id}")
                  .locator("#dev-reload-button"))
    reload_btn.click()
    time.sleep(3)
    ext_page.close()

    # Step 3: try extension page after reload -- FAILS
    try:
        page2 = ctx.new_page()
        page2.goto(f"chrome-extension://{ext_id}/popup.html", timeout=5000)
        print("AFTER reload: extension page loads OK")
    except Exception as e:
        print(f"AFTER reload: FAILED - {e}")

    # Step 4: check service worker -- FAILS
    print(f"Service workers count: {len(ctx.service_workers)}")
    if ctx.service_workers:
        try:
            ctx.service_workers[0].evaluate("1+1")
            print("Service worker: alive")
        except Exception as e:
            print(f"Service worker: DEAD - {e}")

    ctx.close()
```

### Expected output

```
BEFORE reload: extension page loads OK
AFTER reload: extension page loads OK
Service workers count: 1
Service worker: alive
```

### Actual output

```
BEFORE reload: extension page loads OK
AFTER reload: FAILED - Page.goto: net::ERR_BLOCKED_BY_CLIENT
    at chrome-extension://.../popup.html
Service workers count: 0
```

### Alternative reload methods (all produce the same result)

| Method | Same failure? |
|---|---|
| `chrome.runtime.reload()` from service worker | Yes |
| `chrome.runtime.sendMessage({type: "ReloadExtension"})` from extension page | Yes |
| Click reload button on `chrome://extensions/` page | Yes |
| Close + reopen browser context with same `user_data_dir` | No (works) |

## What Chrome does during extension reload

1. Old service worker is terminated
2. Old extension page contexts are invalidated
3. New service worker is started
4. Extension pages become available again
5. In a regular Chrome session, everything reconnects seamlessly

## What Playwright's CDP layer does (the bug)

1. Playwright holds CDP `Target` references for the extension's service
   worker and any open extension pages
2. On reload, Chrome sends CDP events to destroy old targets
   (`Target.targetDestroyed` or `Target.detachedFromTarget`)
3. Playwright removes the old targets from its internal tracking
4. Chrome creates new targets for the reloaded extension's service worker
5. **BUG: Playwright does not detect or attach to these new targets**
6. `context.service_workers` becomes empty (or retains a stale reference)
7. No `serviceworker` event is emitted on the `BrowserContext`
8. Navigation to `chrome-extension://` pages fails because Playwright
   cannot associate them with a valid CDP target

## Where to look in Playwright source

The relevant code is in Playwright's Chromium browser context
implementation, specifically:

### Service worker lifecycle tracking

File: `packages/playwright-core/src/server/chromium/crBrowser.ts`
(or similar -- the exact path may vary by version)

Look for:
- How `Target.targetCreated` events are handled for service worker targets
- Whether extension service workers are re-detected after reload
- The `serviceworker` event emission on `BrowserContext`

### Extension page target tracking

Look for:
- How `chrome-extension://` page targets are handled
- Whether new extension page targets are accepted after the old ones
  are destroyed

### CDP session re-attachment

The core issue: when a service worker target is destroyed and a new one
with the same extension ID appears, Playwright should:
1. Detect the new `Target.targetCreated` event
2. Create a new CDP session for the target
3. Add it to `context.service_workers`
4. Emit a `serviceworker` event

### Diagnostic approach

1. Enable CDP protocol logging to see if Chrome sends `Target.targetCreated`
   for the new service worker after reload
2. If Chrome DOES send the event, the bug is in Playwright's event handler
   (filtering it out or not processing it)
3. If Chrome does NOT send the event, the bug is in Chrome's CDP
   implementation (unlikely, since this worked in Chromium 133)

To enable CDP logging in Playwright:
```
DEBUG=pw:protocol npx playwright test
```
Or in Python:
```
DEBUGP=pw:protocol python -m pytest ...
```

## Impact

This breaks any Playwright test that relies on extension reload:
- Token refresh tests (set token -> reload -> verify refresh)
- Extension update tests
- Any test using `chrome.runtime.reload()`

Current workaround: close the browser context and create a new one with
the same `user_data_dir`, which gives the extension a clean CDP session.
This is slow (full browser restart) and requires re-setting up test
infrastructure (mock endpoints, etc.).

## Related issues

- [Playwright #37017](https://github.com/microsoft/playwright/issues/37017) --
  Chrome 137+ removed `--load-extension` flags (broader extension instability)
- [Playwright #34711](https://github.com/microsoft/playwright/issues/34711) --
  Extension pages blocked with `ERR_BLOCKED_BY_CLIENT` in chrome-beta
- [Playwright #33682](https://github.com/microsoft/playwright/issues/33682) --
  `context.waitForEvent('serviceworker')` stuck after extension reload
  (reported for Playwright 1.49, same root cause)

Issue #33682 is particularly relevant -- it reports the service worker
event not firing after extension changes, starting from Playwright 1.49.
The symptoms match exactly.