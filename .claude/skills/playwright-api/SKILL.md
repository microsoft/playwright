---
name: playwright-api
description: Explains how to add playwright API methods.
---

# API

## Adding and modifying APIs
- Before performing the implementation, go over the steps to understand and plan the work ahead. It is important to follow the steps in order, as some of them are prerequisites for others.
- Define (or update) API in `docs/api/class-xxx.md`. For the new methods, params and options use the version from package.json (without -next).
- Watch will kick in and re-generate types for the API
- Implement the new API in `packages/playwright/src/client/xxx.ts`
- Define (or update) channel for the API in `packages/protocol/src/protocol.yml` as needed
- Watch will kick in and re-generate types for protocol channels
- Implement dispatcher handler in `packages/playwright/src/server/dispatchers/xxxDispatcher.ts` as needed
- Handler should just route the call into the corresponding method in `packages/playwright-core/src/server/xxx.ts`
- Place new tests in `tests/page/xxx.spec.ts` or create new test file if needed

# Build
- Assume watch is running and everything is up to date.

# Test
- If your tests are only using page, prefer to place them in `tests/page/xxx.spec.ts` and use page fixture. If you need to use browser context, place them in `tests/library/xxx.spec.ts`.
- Run npm test as `npm run ctest <file>`

# Lint
- In the end lint via `npm run flint`.
