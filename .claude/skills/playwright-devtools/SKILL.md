---
name: playwright-devtools
description: Explains how to start a devtools environment for developing playwright devtools.
---

## Starting a DevTools Environment

Run the startup script to launch a target browser with CDP and a devtools web UI:

```sh
node utils/start_devtools.js 2>&1
```

This will:
1. Launch Chrome with a CDP endpoint on a free port
2. Start the DevTools Controller web UI on another port
3. Print both URLs

Open the two ports in separate browser sessions, e.g. like this:

```
# assuming CDP runs on 14782 and DevTools UI runs on 5000
PLAYWRIGHT_MCP_CDP_ENDPOINT=http://localhost:14782 playwright-cli -s=target open
playwright-cli -s=target snapshot

playwright-cli -s=controller open http://localhost:5000
playwright-cli -s=controller snapshot
```

Now you can interact with the DevTools UI, which will control the target browser via CDP.
Since the DevTools UI shows screenshots of the target browser, you might need to work with screenshots instead of textual snapshots.


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
