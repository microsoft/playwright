---
name: playwright-dev
description: Explains how to develop Playwright - add APIs, MCP tools, CLI commands, and vendor dependencies.
---

# Playwright Development Guide

See [CLAUDE.md](../../../CLAUDE.md) for monorepo structure, build/test/lint commands, and coding conventions.

## Detailed Guides

- [Library Architecture](library.md) — client/server/dispatcher structure, protocol layer, DEPS rules
- [Adding and Modifying APIs](api.md) — define API docs, implement client/server, add tests
- [MCP Tools and CLI Commands](tools.md) — add MCP tools, CLI commands, config options
- [Vendor Dependencies & Bundling](vendor.md) — utilsBundle, coreBundle, babelBundle; adding vendored npm packages; DEPS.list; `check_deps`
- [Updating WebKit Safari Version](webkit-safari-version.md) — update the Safari version string in the WebKit user-agent
- [Bisecting Across Published Versions](bisect-published-versions.md) — reproduce regressions side-by-side from npm and diff `node_modules/playwright/lib/` between versions
- [Dashboard](dashboard.md) - the UI powering the "playwright cli show" command, and how to work on it
