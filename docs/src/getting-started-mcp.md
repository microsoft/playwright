---
id: getting-started-mcp
title: "Playwright MCP"
---

## Introduction

The Playwright MCP server provides browser automation capabilities through the [Model Context Protocol](https://modelcontextprotocol.io), enabling LLMs to interact with web pages using structured accessibility snapshots. It works with VS Code, Cursor, Windsurf, Claude Desktop, and any other MCP client — no vision models required.

## Prerequisites

Before you begin, make sure you have the following installed:
- [Node.js](https://nodejs.org/) 18 or newer
- An MCP client: VS Code, Cursor, Windsurf, Claude Code, Claude Desktop, or similar

## Getting Started

### Installation

Add the Playwright MCP server to your client using the standard configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

#### VS Code

Click one of the buttons below to install directly:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code" />](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5" />](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

Or install via the VS Code CLI:

```bash
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

#### Cursor

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" />](https://cursor.com/en/install-mcp?name=Playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

Or go to `Cursor Settings` → `MCP` → `Add new MCP Server` and use command type with `npx @playwright/mcp@latest`.

#### Claude Code

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

#### Claude Desktop

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user) and use the standard config above.

#### Other clients

The standard configuration works with most MCP clients, including Windsurf, Cline, Goose, Kiro, Codex, Copilot CLI, and others. Consult your client's MCP documentation for where to place the config.

### First interaction

Once the server is connected, ask your AI assistant to interact with a web page:

```txt
Navigate to https://demo.playwright.dev/todomvc and add a few todo items.
```

The assistant will use Playwright MCP tools to open the browser, navigate to the page, and interact with elements — all through structured accessibility snapshots rather than screenshots.

## Core Features

### Accessibility snapshots

Playwright MCP operates on the page's accessibility tree, not pixels. When a tool runs, it returns a structured snapshot showing the page elements, their roles, and text content. The LLM uses element references from these snapshots to interact with the page:

```txt
- heading "todos" [level=1]
- textbox "What needs to be done?" [ref=e5]
- listitem:
  - checkbox "Toggle Todo" [ref=e10]
  - text: "Buy groceries"
```

The LLM reads this snapshot and uses `ref=e5` to type into the textbox or `ref=e10` to check the checkbox.

### Interacting with pages

Playwright MCP provides tools for all common browser interactions:

-   **Navigation**: Open URLs, go back/forward, reload pages.
-   **Clicking and typing**: Click elements, type text, fill forms, select dropdowns.
-   **Screenshots**: Capture the current page or specific elements for visual verification.
-   **Keyboard and mouse**: Press keys, hover, drag and drop.
-   **Dialogs**: Accept or dismiss browser dialogs.
-   **Tabs**: Create, close, and switch between browser tabs.

### Running Playwright code

For complex interactions that go beyond individual tool calls, use the `browser_run_code` tool to execute Playwright scripts directly:

```txt
Run this Playwright code to verify the todo count:
async (page) => {
  const count = await page.getByTestId('todo-count').textContent();
  return count;
}
```

### Network monitoring and mocking

Inspect network traffic and mock API responses:

-   **View network requests**: List all requests made since page load.
-   **Mock routes**: Set up URL pattern matching to return custom responses.
-   **Console messages**: Access browser console output for debugging.

### Storage state

Save and restore browser state including cookies and localStorage:

-   **Save state**: Persist authentication and session data to a file.
-   **Restore state**: Load previously saved state into a new session.
-   **Cookie management**: List, get, set, and delete individual cookies.

## Configuration

### Headed mode

By default, Playwright MCP runs the browser in headed mode so you can see what's happening. To run headless:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--headless"
      ]
    }
  }
}
```

### Browser selection

Choose which browser to use:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser=firefox"
      ]
    }
  }
}
```

Supported values: `chrome`, `firefox`, `webkit`, `msedge`.

### User profile

Playwright MCP supports three profile modes:

-   **Persistent (default)**: Login state and cookies are preserved between sessions. The profile is stored in `ms-playwright/mcp-{channel}-profile` in your platform's cache directory. Override with `--user-data-dir`.
-   **Isolated**: Each session starts fresh. Pass `--isolated` to enable. You can load initial state with `--storage-state`.
-   **Browser extension**: Connect to your existing browser tabs with the [Playwright MCP Bridge extension](https://github.com/user-attachments/packages/extension). Pass `--extension` to enable.

### Configuration file

For advanced configuration, use a JSON or INI config file:

```bash
npx @playwright/mcp@latest --config path/to/config.json
```

The config file supports browser options, context options, network rules, timeouts, and more. See the [Playwright MCP repository](https://github.com/microsoft/playwright-mcp/blob/main/packages/playwright-mcp/config.d.ts) for the full type definition.

#### JSON Schema for IDE autocompletion

A JSON Schema is available for configuration files. Add `$schema` to your config file for IDE autocompletion and validation:

```json
{
  "$schema": "https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/tools/mcp/mcp-config.schema.json",
  "browser": {
    "browserName": "chromium"
  }
}
```

If you are using `@playwright/cli`, the project-level config at `.playwright/cli.config.json` will be automatically associated with the schema once registered with [SchemaStore](https://www.schemastore.org/).

**Note:** The JSON Schema only validates JSON config files. INI format config files use the same options but are not validated by this schema.

### Standalone server

When running a headed browser on a system without a display or from IDE worker processes, start the MCP server separately with HTTP transport:

```bash
npx @playwright/mcp@latest --port 8931
```

Then point your MCP client to the HTTP endpoint:

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

## Quick Reference

| Action                    | How to do it                                                  |
| ------------------------- | ------------------------------------------------------------- |
| **Install server**        | Add standard config to your MCP client                        |
| **Navigate to a page**    | Ask: "Go to https://example.com"                              |
| **Click an element**      | Ask: "Click the Submit button"                                |
| **Fill a form**           | Ask: "Fill in the email field with test@example.com"          |
| **Take a screenshot**     | Ask: "Take a screenshot of the page"                          |
| **Run Playwright code**   | Ask: "Run this Playwright code: ..."                          |
| **Mock an API**           | Ask: "Mock the /api/users endpoint to return ..."             |
| **Use headed mode**       | Default. Pass `--headless` to disable                         |
| **Choose a browser**      | Pass `--browser=firefox` in args                              |

## What's Next

-   [Write tests using web-first assertions, page fixtures, and locators](./writing-tests.md)
-   [Run your tests on CI](./ci-intro.md)
-   [Learn more about the Trace Viewer](./trace-viewer.md)