---
id: getting-started-cli
title: "Coding agents"
---

## Introduction

Playwright comes with `playwright-cli`, a command-line interface for browser automation designed for coding agents. It provides token-efficient browser control through concise CLI commands and installable skills, making it ideal for agents that need to balance browser automation with large codebases and reasoning within limited context windows.

### `playwright-cli` vs Playwright MCP

- **`playwright-cli`** is best for **coding agents** (Claude Code, GitHub Copilot, etc.) that favor token-efficient, skill-based workflows. CLI commands avoid loading large tool schemas and verbose accessibility trees into the model context.
- **MCP** is best for specialized agentic loops that benefit from persistent state and iterative reasoning over page structure, such as exploratory automation or long-running autonomous workflows. See the [MCP getting started guide](./getting-started-mcp.md).

## Prerequisites

Before you begin, make sure you have the following installed:
- [Node.js](https://nodejs.org/) 18 or newer
- A coding agent: Claude Code, GitHub Copilot, or similar

## Installation

Install `playwright-cli` globally:

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
```

Alternatively, install `@playwright/cli` as a local dependency and use `npx`:

```bash
npx playwright-cli --help
```

### Installing skills

Coding agents like Claude Code and GitHub Copilot can use locally installed skills for richer context about available commands:

```bash
playwright-cli install --skills
```

### Skills-less operation

You can also point your agent at the CLI directly and let it discover commands on its own:

```txt
Test the "add todo" flow on https://demo.playwright.dev/todomvc using playwright-cli.
Check playwright-cli --help for available commands.
```

## First Steps

### Interactive demo

Try asking your coding agent:

```txt
Use playwright skills to test https://demo.playwright.dev/todomvc/.
Take screenshots for all successful and failing scenarios.
```

### Manual walkthrough

You can also run commands manually to see how the CLI works:

```bash
playwright-cli open https://demo.playwright.dev/todomvc/ --headed
playwright-cli type "Buy groceries"
playwright-cli press Enter
playwright-cli type "Water flowers"
playwright-cli press Enter
playwright-cli check e21
playwright-cli screenshot
```

After each command, the CLI outputs a snapshot of the current page state:

```txt
### Page
- Page URL: https://demo.playwright.dev/todomvc/#/
- Page Title: React • TodoMVC
### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

## Core Commands

### Interacting with pages

```bash
playwright-cli open [url]               # open browser, optionally navigate to url
playwright-cli goto <url>               # navigate to a url
playwright-cli click <ref> [button]     # click an element
playwright-cli type <text>              # type text into editable element
playwright-cli fill <ref> <text>        # fill text into editable element
playwright-cli select <ref> <value>     # select an option in a dropdown
playwright-cli check <ref>              # check a checkbox or radio button
playwright-cli uncheck <ref>            # uncheck a checkbox
playwright-cli hover <ref>              # hover over element
playwright-cli drag <startRef> <endRef> # drag and drop between elements
playwright-cli upload <file>            # upload files
playwright-cli close                    # close the page
```

### Targeting elements

Use element refs from snapshots to target elements:

```bash
playwright-cli snapshot                 # get snapshot with element refs
playwright-cli click e15                # click using a ref
```

You can also use CSS or role selectors:

```bash
playwright-cli click "#main > button.submit"
playwright-cli click "role=button[name=Submit]"
playwright-cli click "#footer >> role=button[name=Submit]"
```

### Screenshots and snapshots

```bash
playwright-cli snapshot                 # capture page snapshot
playwright-cli snapshot --filename=f    # save snapshot to specific file
playwright-cli screenshot               # screenshot of the current page
playwright-cli screenshot [ref]         # screenshot of a specific element
playwright-cli screenshot --filename=f  # save with specific filename
playwright-cli pdf                      # save page as PDF
```

### Navigation

```bash
playwright-cli go-back                  # go back
playwright-cli go-forward               # go forward
playwright-cli reload                   # reload the page
```

### Keyboard and mouse

```bash
playwright-cli press <key>              # press a key (e.g. Enter, ArrowLeft)
playwright-cli keydown <key>            # key down
playwright-cli keyup <key>              # key up
playwright-cli mousemove <x> <y>        # move mouse
playwright-cli mousedown [button]       # mouse button down
playwright-cli mouseup [button]         # mouse button up
playwright-cli mousewheel <dx> <dy>     # scroll
```

### Tabs

```bash
playwright-cli tab-list                 # list all tabs
playwright-cli tab-new [url]            # create a new tab
playwright-cli tab-select <index>       # select a tab
playwright-cli tab-close [index]        # close a tab
```

### Network

```bash
playwright-cli network                  # list network requests since page load
playwright-cli route <pattern> [opts]   # mock network requests
playwright-cli route-list               # list active routes
playwright-cli unroute [pattern]        # remove routes
```

### Storage

```bash
playwright-cli state-save [filename]    # save storage state (cookies, localStorage)
playwright-cli state-load <filename>    # load storage state

# Cookies
playwright-cli cookie-list [--domain]   # list cookies
playwright-cli cookie-get <name>        # get a cookie
playwright-cli cookie-set <name> <val>  # set a cookie
playwright-cli cookie-delete <name>     # delete a cookie
playwright-cli cookie-clear             # clear all cookies

# localStorage
playwright-cli localstorage-list        # list entries
playwright-cli localstorage-get <key>   # get value
playwright-cli localstorage-set <k> <v> # set value
playwright-cli localstorage-delete <k>  # delete entry
playwright-cli localstorage-clear       # clear all
```

### DevTools

```bash
playwright-cli console [min-level]      # list console messages
playwright-cli eval <func> [ref]        # evaluate JavaScript on page
playwright-cli run-code <code>          # run Playwright code snippet
playwright-cli tracing-start            # start trace recording
playwright-cli tracing-stop             # stop trace recording
playwright-cli video-start              # start video recording
playwright-cli video-chapter <title>    # add chapter marker to video
playwright-cli video-stop --filename=f  # stop video recording
```

## Sessions

The CLI keeps the browser profile in memory by default — cookies and storage state are preserved between calls within a session but lost when the browser closes. Use `--persistent` to save the profile to disk.

### Named sessions

Run multiple browser instances for different projects:

```bash
playwright-cli open https://playwright.dev
playwright-cli -s=example open https://example.com --persistent
playwright-cli list                     # list all sessions
```

You can configure your coding agent to use a specific session:

```bash
PLAYWRIGHT_CLI_SESSION=todo-app claude .
```

### Session management

```bash
playwright-cli list                     # list all sessions
playwright-cli close-all                # close all browsers
playwright-cli kill-all                 # forcefully kill all browser processes
playwright-cli -s=name delete-data      # delete user data for a named session
```

## Monitoring

Use `playwright-cli show` to open a visual dashboard for observing and controlling all running browser sessions:

```bash
playwright-cli show
```

The dashboard provides:

- **Session grid** — all active sessions grouped by workspace, each with a live screencast preview, session name, current URL, and page title. Click any session to zoom in.
- **Session detail** — a live view of the selected session with tab bar, navigation controls, and full remote control. Click into the viewport to take over mouse and keyboard; press Escape to release.

## Configuration

### Headed mode

The CLI runs headless by default. To see the browser:

```bash
playwright-cli open https://playwright.dev --headed
```

### Browser selection

```bash
playwright-cli open --browser=chrome    # use specific browser
playwright-cli open --browser=firefox
playwright-cli open --browser=webkit
playwright-cli open --browser=msedge
```

### Configuration file

For advanced settings, use a JSON config file:

```bash
playwright-cli --config path/to/config.json open example.com
```

The CLI also loads `.playwright/cli.config.json` automatically if present. The config file supports browser options, context options, network rules, timeouts, and more. Run `playwright-cli --help` for the full list of options.

A JSON Schema is available for IDE autocompletion. Once registered with [SchemaStore](https://www.schemastore.org/), the `.playwright/cli.config.json` file will be automatically associated in supported editors. For other file names, add `$schema` manually:

```json
{
  "$schema": "https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/tools/mcp/mcp-config.schema.json"
}
```

### Browser extension

Connect to your existing browser tabs instead of launching a new browser:

```bash
playwright-cli open --extension
```

This requires the [Playwright MCP Bridge browser extension](https://github.com/user-attachments/packages/extension) to be installed.

## Quick Reference

| Action                    | Command                                             |
| ------------------------- | --------------------------------------------------- |
| **Install CLI**           | `npm install -g @playwright/cli@latest`             |
| **Install skills**        | `playwright-cli install --skills`                   |
| **Open a page**           | `playwright-cli open https://example.com`           |
| **Click an element**      | `playwright-cli click e15`                          |
| **Type text**             | `playwright-cli type "hello world"`                 |
| **Take a screenshot**     | `playwright-cli screenshot`                         |
| **Get page snapshot**     | `playwright-cli snapshot`                           |
| **Run headed**            | `playwright-cli open https://example.com --headed`  |
| **Use Firefox**           | `playwright-cli open --browser=firefox`             |
| **Monitor sessions**      | `playwright-cli show`                               |

## What's Next

- [Write tests using web-first assertions, page fixtures, and locators](./writing-tests.md)
- [Run your tests on CI](./ci-intro.md)
- [Learn more about the Trace Viewer](./trace-viewer.md)