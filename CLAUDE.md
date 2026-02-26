# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

Requires Node.js 20+.

```bash
npm ci                    # Install dependencies
npm run build             # One-time build
npm run watch             # Build in watch mode (recommended during development)
npx playwright install    # Install browsers after build
```

`npm run watch` also runs linting in watch mode. Some files are **generated** by the build — do not edit them manually (see Generated Files below).

## Testing

```bash
# Library tests (browser API tests)
npm run ctest             # Chromium only (fast path)
npm run ftest             # Firefox only
npm run wtest             # WebKit only
npm run test              # All three browsers

# Test runner tests (tests for the @playwright/test runner itself)
npm run ttest

# MCP tests
npm run ctest-mcp         # Chrome only (fast path)
npm run test-mcp          # All MCP tests

# Component tests
npm run ct

# Run a specific test file (library tests)
npx playwright test --config=tests/library/playwright.config.ts --project=chromium-library path/to/test.spec.ts

# Run a specific test file (test runner tests)
node ./tests/playwright-test/stable-test-runner/node_modules/@playwright/test/cli test --config=tests/playwright-test/playwright.config.ts path/to/test.spec.ts
```

Environment variables for test runs:
- `CRPATH`, `FFPATH`, `WKPATH` — override browser executable paths
- `PWTEST_MODE` — test mode (`default`, `service`, `service2`)
- `PWTEST_CHANNEL` — browser channel override
- `PWTEST_VIDEO=1`, `PWTEST_TRACE=1` — enable video/trace capture
- `DEBUG=pw:browser` — debug custom browser builds

## Linting

```bash
npm run lint              # Full lint suite (eslint + tsc + doc + dep checks + type gen + test lint)
npm run flint             # Same but runs all checks in parallel (faster)
npm run eslint            # ESLint only
npm run tsc               # TypeScript type check only
```

## Code Generation (must run after protocol/API changes)

```bash
node utils/generate_channels.js   # Regenerate channel types from protocol.yml
node utils/generate_types/        # Regenerate TypeScript public API types from docs/src
npm run doc                       # Validate/generate documentation
npm run check-deps                # Enforce DEPS.list rules
```

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
label(namespace): title
```
Labels: `fix`, `feat`, `docs`, `test`, `devops`, `chore`

Example: `feat(trace viewer): network panel filtering`

## Architecture

### Package Structure (npm workspaces under `packages/`)

| Package | Purpose |
|---|---|
| `playwright-core` | Browser automation library — all browser APIs, no test runner |
| `playwright` / `playwright-test` | Test runner (`@playwright/test`) — fixtures, reporters, config loader, matchers |
| `protocol` | Source of truth: `protocol.yml` defines the IPC wire protocol |
| `trace` / `trace-viewer` | Trace file format and the trace viewer React app |
| `html-reporter` | HTML test report React app |
| `recorder` | Codegen/inspector recorder UI |
| `injected` | Scripts injected into browser pages (selectors engine, etc.) |
| `playwright-ct-*` | Component testing adapters (React, Vue, etc.) |
| `web` | Shared frontend utilities |
| `devtools` | DevTools integration |
| `playwright-client` | Thin CLI client wrapper |

### Core Architecture: IPC via Dispatcher/ChannelOwner

Playwright uses a two-process model. The public API layer (Node.js client) communicates with a server process via a typed IPC protocol:

- **Protocol definition**: `packages/protocol/src/protocol.yml` — single source of truth for all channels, methods, events, and parameters.
- **Generated files** (do not edit manually):
  - `packages/protocol/src/channels.d.ts` — TypeScript channel types
  - `packages/protocol/src/validator.ts` — runtime validation
- **Server side**: `packages/playwright-core/src/server/` — `SdkObject` base class, browser implementations (`chromium/`, `firefox/`, `webkit/`, `bidi/`), and `dispatchers/` which expose server objects over the protocol.
- **Client side**: `packages/playwright-core/src/client/` — `ChannelOwner` base class wraps channel handles; `Page`, `BrowserContext`, `Frame`, etc. live here.
- **Transport**: `inprocess.ts` (same-process, used in tests), `outofprocess.ts` (child process via pipe), or WebSocket for remote connections.

### Test Runner Architecture (`packages/playwright/src/`)

- `common/` — config loading, fixture definitions, test types, globals
- `runner/` — orchestrates parallel test execution: `taskRunner.ts` → `tasks.ts` → `workerHost.ts` → worker processes
- `worker/` — runs inside worker processes: `workerMain.ts`, `testInfo.ts`, fixture runner
- `matchers/` — `expect()` extensions (`toHaveText`, `toBeVisible`, snapshot matchers, etc.)
- `reporters/` — built-in reporters (list, dot, html, json, junit, blob, etc.)
- `loader/` — test file loading, ESM/CJS transform via `transform/`
- `mcp/` — MCP server integration (`@playwright/mcp`)

### Dependency Enforcement (`DEPS.list`)

Each package directory contains a `DEPS.list` file that restricts what other packages/directories can be imported. `npm run check-deps` enforces these rules. This prevents circular dependencies between layers (e.g., `injected` scripts cannot import Node.js-only code).

### Generated & Auto-updated Files

These files are regenerated by `npm run watch` or specific `utils/` scripts — changes in the source files that drive them will overwrite manual edits:
- `packages/protocol/src/channels.d.ts` and `validator.ts` — from `protocol.yml`
- TypeScript public API types — from `docs/src/` API markdown files
- `packages/playwright/types/` — public type declarations

### Test Suites Location

- `tests/library/` — browser API tests (run with `ctest`/`ftest`/`wtest`)
- `tests/page/` — page-level API tests
- `tests/playwright-test/` — test runner self-tests (run with `ttest`)
- `tests/mcp/` — MCP integration tests
- `tests/components/` — component testing tests
- `tests/android/`, `tests/electron/` — platform-specific test suites

### Documentation-Driven API

Public API is documented in `docs/src/api/` (markdown with custom structure). TypeScript types and validation are generated from these docs. When adding or changing a public API:
1. Update `docs/src/api/` markdown
2. Update `packages/protocol/src/protocol.yml` for new IPC methods/events
3. Run `npm run watch` to regenerate derived files
