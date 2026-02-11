---
name: playwright-devtools
description: Explains how to start a devtools environment for developing playwright devtools.
---

## Starting a DevTools Environment

Open two separate `playwright-cli` sessions — a **target** browser and a **controller** that shows the DevTools UI.

### 1. Open the target browser

```sh
npm run playwright-cli -- -s=target open data:text/html,...
```

### 2. Start the DevTools UI on the target

```sh
npm run playwright-cli -- -s=target show
```

This prints the DevTools URL (e.g. `Show server is listening on: http://...`).

### 3. Open the controller browser pointing at the DevTools URL

```sh
npm run playwright-cli -- -s=controller open <devtools-url>
```

Replace `<devtools-url>` with the URL printed in step 2.

### Interacting with the sessions

```sh
npm run playwright-cli -- -s=target snapshot
npm run playwright-cli -- -s=controller snapshot
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
