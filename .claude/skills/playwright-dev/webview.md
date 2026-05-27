# WebView (iOS Safari) Backend Reference

Notes for developing the **stock-Mobile-Safari** backend in
[packages/playwright-core/src/server/webkit/webview/](../../../packages/playwright-core/src/server/webkit/webview/).
The regular WebKit backend one level up (`webkit/`) runs against a
Playwright-patched WebKit build; the `webview/` folder targets unmodified
Safari on real iOS/iPadOS or the iOS Simulator over the standard Web Inspector
Protocol.

## What is and isn't available

Stock Mobile Safari only exposes the upstream Web Inspector Protocol. Anything
Playwright added to its forked WebKit is not available here.

**Available** — methods/events in `Source/JavaScriptCore/inspector/protocol/*.json`
on `browser_upstream/main`:

```bash
git -C ~/webkit show browser_upstream/main:Source/JavaScriptCore/inspector/protocol/<Domain>.json
```

**Not available** — anything added by the Playwright WebKit patches:

```bash
ls ~/playwright-browsers/browser_patches/webkit/patches/  # bootstrap.diff lives here
```

Quick provenance check for a symbol — in `~/webkit`:

```bash
git log --all -S "<symbol>" -- <path>
```

If every hit is a `chore(webkit): bootstrap build` commit, it's a Playwright
patch. Some traps where the upstream name overlaps with a Playwright-only
helper of similar intent:

- `Target.setPauseOnStart` / `Target.resume` (**upstream**, gates loading of
  provisional process-swap targets) vs `PageInspectorController::pauseOnStart`
  / `resumeIfPausedInNewWindow` (**Playwright patch**, for `window.open`
  popups). They sound the same; they aren't.
- `Playwright.*` domain (cookies, navigate, all global controls) — entirely
  Playwright. Use stock equivalents on the page session (e.g. `Page.getCookies`).
- `Network.continueWithAuth`, intercepted-response body access via Network —
  Playwright extensions.

## Architecture

This backend deliberately mirrors the regular WebKit backend one level up
(`wkConnection.ts` / `wkPage.ts` / `wkProvisionalPage.ts`). When in doubt,
read the WK equivalent — the WV class should look almost the same. The
`outerSession` is the WV analogue of WK's page-proxy session.

```
WebSocketTransport (ws://localhost:9222/devtools/page/<n>, via ios_webkit_debug_proxy)
  → WVConnection            — dumb transport; owns only outerSession
      → WVConnection.outerSession (sessionId "")  — Target.sendMessageToTarget bridge
          → WVPage          — owns per-target WVSessions, routes
                              Target.dispatchMessageFromTarget, manages swaps
              → _session (current) + WVProvisionalPage (during a swap)
              → WVExecutionContext, WVWorkers, RawKeyboard/Mouse/Touchscreen
                (all hold a session reference, all have setSession() for swap)
```

`WVConnection` is intentionally minimal: it pumps the transport into
`outerSession` and back. `WVPage` creates the per-target `WVSession`s
(`_createSession`), routes `Target.dispatchMessageFromTarget` by `targetId` to
either `_session` or `_provisionalPage._session`, and handles
`Target.targetCreated/targetDestroyed/didCommitProvisionalTarget` — exactly
like `WKPage`. `WVPage` is constructed with the outer session (not a target
session); `_session` starts undefined and is bound on the first
`Target.targetCreated` via `_setSession`. `WVBrowser._attachTab` awaits
`page.waitForInitialized()` (resolves after the first target is reported as
new) instead of waiting on the connection.

## Process swap / provisional targets

Cross-origin navigation in an existing tab can make Mobile Safari spawn a new
process. The protocol sequence is:

```
Target.targetCreated  targetInfo:{ isProvisional:true, isPaused:true }
... events on the provisional target during the navigation ...
Target.didCommitProvisionalTarget  oldTargetId, newTargetId
Target.targetDestroyed  oldTargetId
```

Handling mirrors WK — `WVProvisionalPage` ≈ `WKProvisionalPage`, swapped in by
`WVPage._onDidCommitProvisionalTarget`. The one essential trick:
`Target.setPauseOnStart` (sent in `WVBrowser._attachTab`) makes provisional
targets arrive `isPaused`, so `WVPage` can set up interception / bootstrap
before resuming them with `Target.resume`; otherwise the new process races
ahead and `page.route(...)` never fires.

Not to be confused with the **popup-pause** path (`window.open`), which is a
Playwright patch (`PageInspectorController::pauseOnStart`) with no stock-Safari
equivalent.

## Test infrastructure

```
tests/webview/
  playwright.config.ts        — single project "webkit-webview-page", runs tests/page/
  webviewTest.ts              — fixture: discovers tab via ios_webkit_debug_proxy /json,
                                resets Mobile Safari between tests
  expectations/
    webkit-webview-page.txt   — `<test path> › <name> [fail|flaky|timeout|skip]`
  expectationUtil.ts          — loader + skip-decision logic
```

`[fail]` entries cause `it.skip()` to fire before the test body runs — so a
formerly-failing test that now passes won't be flagged automatically, you have
to remove the line and re-run. The marker also has prefix-match semantics for
`it.step` children.

### Running locally

```bash
./utils/run_webview_tests.sh           # ensures ios_webkit_debug_proxy is up on 9222
npm run wvtest -- -g "<test title>"    # single test
npm run wvtest -- tests/page/foo.spec.ts
DEBUG=pw:protocol npm run wvtest -- -g "<title>" > /tmp/log 2>&1
```

The simulator needs to be booted with one Mobile Safari tab. The script's only
job is keeping a single
`ios_webkit_debug_proxy -F -d -s unix:<socket> -c null:9221,:9222-9322` alive;
everything else is done by the fixture.

### Common local pitfalls

- **Multiple `ios_webkit_debug_proxy` processes** — every protocol event is
  delivered through each instance, so debug logs show events duplicated and
  some tests flake. `pgrep -lf ios_webkit_debug_proxy` and clean up.
- **Chrome bound to `127.0.0.1:9222`** — Chrome's `--remote-debugging-port=9222`
  shadows iwdp's `*:9222` listener for traffic addressed to `localhost`.
  Kill the Chrome instance (`lsof -nP -iTCP -sTCP:LISTEN | grep 9222`).
- **Stale launchd socket** — `lsof -aUc launchd_sim` should show
  `com.apple.webinspectord_sim.socket` for the currently booted simulator. If
  iwdp was started against an older `launchd_sim` socket path it will silently
  serve nothing.

## CI

[.github/workflows/tests_webview_simulator.yml](../../../.github/workflows/tests_webview_simulator.yml)
runs the same suite on `macos-15` (booted iOS Simulator +
`brew install ios-webkit-debug-proxy`). Triggers: `workflow_dispatch`, and
`pull_request` only when paths under `tests/webview/**`, the `webview/` source
folder, or the workflow file itself change.
