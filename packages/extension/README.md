# Playwright Chrome Extension (Task Isolated)

This local fork of the Playwright Chrome extension keeps every CLI or MCP task in a separately owned tab group. It is intended for running concurrent automation against an existing Chrome profile without replacing the official extension or interrupting the user's active tab.

## Behavior

- Each CLI session name, explicit `PLAYWRIGHT_MCP_TASK_ID`, or generated MCP connection ID gets a unique tab group.
- Background approval creates an inactive task-owned blank tab. New tabs and popups created by the task stay owned by that task.
- Playwright's logical `bringToFront` command does not activate a Chrome tab. The only path that activates a selected target is the explicit **Allow & select** button.
- Disconnect, success, failure, cancellation, timeout, transport loss, and stale service-worker recovery close only tabs recorded as task-owned. User tabs that were explicitly shared or dragged into the group are only ungrouped.
- Multiple connections can coexist; the extension status page can disconnect them individually.

## Build and install alongside the official extension

Prerequisites: Node.js, npm, and Chrome/Edge/Chromium.

```bash
git clone https://github.com/WitMiao/playwright.git
cd playwright
git checkout codex/session-isolated-extension
npm ci
npm run build
```

Then open `chrome://extensions`:

1. Enable **Developer mode**.
2. Choose **Load unpacked**.
3. Select `packages/extension/dist` from this checkout.
4. Verify the displayed ID is `mmblklcefccekjbfjehkpmeibpjlanca`.

The fork uses a separate pinned extension ID, so the Chrome Web Store version can remain installed. Do not disable or uninstall the official extension. Use the CLI/MCP entry points from this checkout because they are pinned to the local extension ID.

## CLI usage

Use a distinct session name for every concurrent task. That name becomes the readable ownership label and allows subsequent commands or generated scripts to reuse the same daemon session.

```bash
npm run playwright-cli -- -s=invoice-audit attach --extension=chrome
npm run playwright-cli -- -s=invoice-audit tab-new https://example.com
npm run playwright-cli -- -s=invoice-audit run-code --filename=automation.js
npm run playwright-cli -- -s=invoice-audit detach
```

`detach` ends the task connection and triggers extension cleanup. `close` is also supported. Keep unrelated concurrent work on a different `-s=<name>`.

## MCP usage

Run the MCP entry point built by this checkout and provide an explicit task ID when the caller can identify the job:

```json
{
  "mcpServers": {
    "playwright-isolated": {
      "command": "node",
      "args": [
        "/absolute/path/to/playwright/packages/playwright-core/lib/entry/mcp.js",
        "--extension",
        "--snapshot-mode=none"
      ],
      "env": {
        "PLAYWRIGHT_MCP_TASK_ID": "replace-with-one-id-per-task"
      }
    }
  }
}
```

If `PLAYWRIGHT_MCP_TASK_ID` is omitted, the server generates a unique ID. Never reuse one explicit task ID for concurrently running jobs.

The optional authentication token shown by the extension can skip the approval page. Treat it as a secret: provide it only through the `PLAYWRIGHT_MCP_EXTENSION_TOKEN` environment variable and never commit or log it.

## Lower-token workflow

- Prefer one named CLI session plus `run-code --filename=...` for a complete multi-step flow instead of many one-command round trips.
- For MCP jobs that do not need element references in every response, use `--snapshot-mode=none` and request a snapshot only when needed.
- Reuse generated scripts and session names; avoid repeated full snapshots, console dumps, network logs, traces, and screenshots unless they answer a specific diagnostic question.
- Give every parallel task its own session/task ID so retries never inherit another job's resources.

## Focus limitation

Extension-created tabs are inactive and Playwright tab selection is kept logical. However, when Chrome is launched or asked by the operating system to open the extension's `connect.html` URL, Chrome itself may briefly foreground that connection page before extension JavaScript runs. Chrome does not expose an extension API that can retroactively guarantee the original application focus in this startup path. Token-based approval avoids the interactive page after Chrome has already received the URL, but cannot eliminate this browser/OS startup limitation.
