---
name: playwright-devtools
description: Explains how to start a devtools environment for developing playwright devtools.
---

## Starting a DevTools Environment

Run the startup script to launch a target browser with CDP and a devtools web UI:

```sh
node utils/start_devtools.js 2>&1 &
```

This will:
1. Launch Chrome with a CDP endpoint on a free port
2. Start the DevTools UI via `context._devtoolsStart()`
3. Automatically open two named `playwright-cli` sessions:
   - `target` — connected to the CDP browser
   - `controller` — showing the DevTools UI

Once started, interact with the sessions by name:

```sh
playwright-cli -s=target snapshot
playwright-cli -s=controller snapshot
```

Since the controller shows screenshots of the target browser, you might need to work with screenshots and coordinate-based clicking instead of textual snapshots.

## Important Files

- Server: `packages/playwright-core/src/server/devtoolsController.ts`
- Server integration: `packages/playwright-core/src/server/browserContext.ts` (`devtoolsStart` / `devtoolsStop`)
- Frontend app: `packages/devtools/src/devtools.tsx`
- Frontend transport: `packages/devtools/src/transport.ts`
- Tests: `tests/library/browsercontext-devtools.spec.ts`

## Building

Assume `npm: watch` is running. The frontend is built by Vite from `packages/devtools/` into `packages/playwright-core/lib/vite/devtools/`.

## Testing

```sh
npx playwright test tests/library/browsercontext-devtools.spec.ts
```
