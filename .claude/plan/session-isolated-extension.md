# Session-isolated Playwright extension

## Goal

Make the local Playwright Chrome extension safe for concurrent CLI/MCP tasks without taking browser focus or deleting user-owned tabs.

## Implementation

- [x] Propagate the CLI session name or explicit `PLAYWRIGHT_MCP_TASK_ID` through the MCP relay URL.
- [x] Replace the extension's single active connection with independent connection records and unique tab groups.
- [x] Create automation tabs in the background and remove focus-changing calls.
- [x] Track task-created tabs separately from user-selected tabs and clean only owned resources on disconnect, cancellation, timeout, or service-worker recovery.
- [x] Preserve CLI/MCP protocol compatibility and document low-token batch workflows.
- [x] Add targeted regressions for concurrent sessions, focus preservation, and ownership-safe cleanup.

## Acceptance criteria

- Two extension clients remain connected simultaneously and receive different group identities.
- Opening or selecting task tabs does not activate a tab or focus a Chrome window.
- Closing either task removes only tabs created by that task and leaves the other task and user tabs intact.
- Existing extension MCP and CLI session tests continue to pass.
- Extension build, repository type checking, lint for touched files, and targeted tests pass.
- The result is committed; push/draft PR is attempted only after rebasing on current `upstream/main`.
