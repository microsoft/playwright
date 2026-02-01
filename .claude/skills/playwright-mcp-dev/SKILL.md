---
name: playwright-mcp-dev
description: Explains how to add and debug playwright MCP tools and CLI commands.
---

# MCP

## Adding MCP Tools
- Create a new tool in `packages/playwright/src/mcp/browser/tools/your-tool.ts`
- Register the tool in `packages/playwright/src/mcp/browser/tools.ts`
- Add ToolCapability in `packages/playwright/src/mcp/config.d.ts`
- Place new tests in `tests/mcp/mcp-<category>.spec.ts`

## Building
- Assume watch is running at all times, run lint to see type errors

## Testing
- Run tests as `npm run ctest-mcp <category>`
- Do not run test --debug

# CLI

## Adding commands
- CLI commands are based on MCP tools. Implement the corresponding MCP tool as per `Adding MCP Tools` section above, if needed.
- Add new CLI category for tool if needed:
  - Add Category in `packages/playwright/src/mcp/terminal/command.ts`
  - Update doc generator `packages/playwright/src/mcp/terminal/helpGenerator.ts`
- Register command in `packages/playwright/src/mcp/terminal/commands.ts`
- Update skill file at `packages/playwright/src/skill/SKILL.md` and references if necessary
  in `packages/playwright/src/skill/references/`
- Place new tests in `tests/mcp/cli-<category>.spec.ts`

## Building
- Assume watch is running at all times, run lint to see type errors

## Testing
- Run tests as `npm run ctest-mcp cli-<category>`
- Do not run test --debug

# Lint
- run `npm run flint` to lint everything before commit
