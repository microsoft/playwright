---
id: bun-runtime
title: "Running under Bun"
---

Playwright's test runner detects the Bun runtime automatically. When invoked
under `bun`, the runner installs its babel pipeline via `Bun.plugin()` so that
custom `babelPlugins`, CSS-import stripping, and source-map–driven test
location reporting all behave the same as under Node.

## Minimum version

Playwright requires `bun >= 1.3.14`. Older releases have IPC and stack-trace
gaps that affect the test worker. The runner fails fast at startup if the
version is too low.

## Known sharp edges

These are tracked upstream and may degrade behavior under bun without
breaking it outright.

| Area | Status | Notes |
|---|---|---|
| `child_process.fork()` IPC | Partial | Backpressure ([oven-sh/bun#30569](https://github.com/oven-sh/bun/issues/30569)); no socket-handle passing ([#28764](https://github.com/oven-sh/bun/issues/28764)) |
| `module.register()` | Not implemented | Replaced by `Bun.plugin()` internally |
| `Error.prepareStackTrace` | Partial | ESM filenames are URLs ([#30298](https://github.com/oven-sh/bun/issues/30298)); normalized by `wrapFunctionWithLocation` |
| `worker_threads` | Partial | Missing `stdio`/`resourceLimits`; not usable as a fork alternative |
| `node:vm` `cachedData` | Partial | May degrade trace/scripting features |
| `node:http` outgoing body | Buffered | Affects the test-server only with large streamed bodies |

## Diagnostics

The worker environment exposes `PW_RUNTIME` (`node` or `bun`) for use in
reporters and logs.
