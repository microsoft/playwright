---
name: playwright-dev
description: Explains how to develop Playwright - add APIs, MCP tools, CLI commands, and vendor dependencies.
---

# Playwright Development Guide

## Table of Contents

- [Adding and Modifying APIs](api.md) — define API docs, implement client/server, add tests
- [MCP Tools and CLI Commands](mcp-dev.md) — add MCP tools, CLI commands, config options
- [Vendoring Dependencies](vendor.md) — bundle third-party npm packages into playwright-core or playwright

## Build
- Assume watch is running and everything is up to date.
- If not, run `npm run build`.

## Lint
- Run `npm run flint` to lint everything before commit.
