---
name: playwright-trace
description: Inspect Playwright trace files from the command line — list actions, view requests, console, errors, snapshots and screenshots.
allowed-tools: Bash(npx playwright trace:*)
---

# Playwright Trace CLI

Inspect `.zip` trace files produced by Playwright tests without opening a browser.

## Workflow

1. Start with `trace open <trace.zip>` to extract the trace and see its metadata, or run `trace summary <trace.zip>` for a quick overview.
2. Use `trace actions` to see all actions with their action IDs.
3. Use `trace action <action-id>` to drill into a specific action — see parameters, logs, source location, and available snapshots.
4. Use `trace requests`, `trace console`, or `trace errors` for cross-cutting views.
5. Use `trace snapshot <action-id>` to get the DOM snapshot, or run a browser command against it.
6. Use `trace close` to remove the extracted trace data when done.

All commands after `open` operate on the currently opened trace — no need to pass the trace file again. Opening a new trace replaces the previous one. `trace summary` can inspect a trace archive directly or operate on the opened trace.

## Commands

### Summary of trace

```bash
# High-level execution summary: metadata, action counts, failures, request errors, and console errors
npx playwright trace summary

# Open and summarize a trace archive directly
npx playwright trace summary <trace.zip>

# Output machine-readable JSON for agents and CI
npx playwright trace summary --json
npx playwright trace summary <trace.zip> --json
```

JSON output schema:
```json
{
  "status": "passed | failed",
  "metadata": {
    "browser": "chromium",
    "platform": "darwin",
    "playwrightVersion": "1.50.0",
    "title": "test title",
    "duration": "1.2s",
    "durationMs": 1200,
    "startTime": "2025-01-01T00:00:00.000Z",
    "viewport": "1280x720"
  },
  "actions": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "firstFailure": { "ordinal": 5, "title": "page.click", "error": "Timeout 5000ms exceeded" }
  },
  "network": {
    "total": 10,
    "successful": 9,
    "failed": 1,
    "failures": [
      { "ordinal": 8, "method": "GET", "url": "https://api.example.com/data", "status": 500, "failure": "net::ERR_FAILED" }
    ]
  },
  "errors": {
    "total": 1,
    "testErrors": 1,
    "consoleErrors": 0,
    "pageErrors": 0,
    "stderr": 0
  }
}
```

### Open a trace

```bash
# Extract trace and show metadata: browser, viewport, duration, action/error counts
npx playwright trace open <trace.zip>
```

### Close a trace

```bash
# Remove extracted trace data
npx playwright trace close
```

### Actions

```bash
# List all actions as a tree with action IDs and timing
npx playwright trace actions

# Filter by action title (regex, case-insensitive)
npx playwright trace actions --grep "click"

# Only failed actions
npx playwright trace actions --errors-only

# Output structured JSON
npx playwright trace actions --json
```

JSON output (`Array<TraceActionSummary>`):
```json
[
  {
    "ordinal": 1,
    "callId": "call@1",
    "title": "page.goto",
    "startTime": 12.5,
    "duration": 150.2,
    "durationFormatted": "150ms",
    "status": "passed"
  }
]
```

### Action details

```bash
# Show full details for one action: params, result, logs, source, snapshots
npx playwright trace action <action-id>

# Output action details in JSON
npx playwright trace action <action-id> --json
```

JSON output (`TraceActionDetails`):
```json
{
  "ordinal": 1,
  "callId": "call@1",
  "title": "page.click",
  "startTime": 12.5,
  "duration": 50.0,
  "durationFormatted": "50ms",
  "status": "passed",
  "params": { "selector": "button#submit" },
  "result": {},
  "log": [{ "time": 13.0, "message": "waiting for element" }],
  "stack": [{ "file": "test.spec.ts", "line": 15, "column": 5 }],
  "snapshots": ["before", "action", "after"]
}
```

The `action` command displays available snapshot phases (before, action, after) and the exact command to extract them.

### Requests

```bash
# All network requests: start time (on the `trace actions` clock), method, status, URL, duration, size
npx playwright trace requests

# Filter by URL pattern
npx playwright trace requests --grep "api"

# Filter by HTTP method
npx playwright trace requests --method POST

# Only failed requests (status >= 400)
npx playwright trace requests --failed

# Output structured JSON
npx playwright trace requests --json
```

JSON output (`Array<TraceRequestSummary>`):
```json
[
  {
    "ordinal": 1,
    "method": "GET",
    "url": "https://example.com/api",
    "status": 200,
    "statusText": "OK",
    "startTime": 10.5,
    "duration": 45.0,
    "durationFormatted": "45ms",
    "bodySize": 1024,
    "contentType": "application/json"
  }
]
```

### Request details

```bash
# Show full details for one request: headers, body, security
npx playwright trace request <request-id>

# Output request details in JSON
npx playwright trace request <request-id> --json
```

JSON output (`TraceRequestDetails`):
```json
{
  "ordinal": 1,
  "method": "POST",
  "url": "https://example.com/api",
  "status": 200,
  "statusText": "OK",
  "startTime": 10.5,
  "duration": 45.0,
  "durationFormatted": "45ms",
  "size": 1024,
  "contentType": "application/json",
  "requestHeaders": [{ "name": "Content-Type", "value": "application/json" }],
  "requestBody": "{\"query\":\"test\"}",
  "responseHeaders": [{ "name": "Content-Type", "value": "application/json" }],
  "responseBody": "{\"status\":\"ok\"}"
}
```

### Console

```bash
# All console messages and stdout/stderr
npx playwright trace console

# Only errors
npx playwright trace console --errors-only

# Only browser console (no stdout/stderr)
npx playwright trace console --browser

# Only stdout/stderr (no browser console)
npx playwright trace console --stdio

# Filter by message text pattern
npx playwright trace console --grep "failed to fetch"

# Output structured JSON
npx playwright trace console --json
```

JSON output (`Array<TraceConsoleItem>`):
```json
[
  {
    "ordinal": 1,
    "type": "browser",
    "level": "error",
    "text": "Failed to load resource: net::ERR_CONNECTION_REFUSED",
    "location": "app.js:42",
    "timestamp": 12345.6
  }
]
```

### Errors

```bash
# All errors with stack traces and associated actions
npx playwright trace errors

# Output structured JSON
npx playwright trace errors --json
```

JSON output (`Array<TraceErrorItem>`):
```json
[
  {
    "actionOrdinal": 5,
    "actionTitle": "page.click",
    "message": "Error: element not found",
    "stack": [{ "file": "test.spec.ts", "line": 20, "column": 3 }]
  }
]
```

### Snapshots

The `snapshot` command loads the DOM snapshot for an action into a headless browser and runs a single browser command against it. Without a browser command, it returns the accessibility snapshot.

```bash
# Get the accessibility snapshot (default)
npx playwright trace snapshot <action-id>

# Use a specific phase
npx playwright trace snapshot <action-id> --phase before

# Run eval to query the DOM
npx playwright trace snapshot <action-id> -- eval "document.title"
npx playwright trace snapshot <action-id> -- eval "document.querySelector('#error').textContent"

# Eval on a specific element ref (from the snapshot)
npx playwright trace snapshot <action-id> -- eval "el => el.getAttribute('data-testid')" e5

# Take a screenshot of the snapshot
npx playwright trace snapshot <action-id> -- screenshot

# Redirect output to a file
npx playwright trace snapshot <action-id> -- eval "document.body.outerHTML" --filename=page.html
npx playwright trace snapshot <action-id> -- screenshot --filename=screenshot.png
```

Only three browser commands are useful on a frozen snapshot: `snapshot`, `eval`, and `screenshot`.

### Attachments

```bash
# List all trace attachments
npx playwright trace attachments

# Extract an attachment by its number
npx playwright trace attachment 1
npx playwright trace attachment 1 -o out.png
```

## Typical investigation

```bash
# 1. Open the trace and see what's inside
npx playwright trace open test-results/my-test/trace.zip

# 2. What actions ran?
npx playwright trace actions

# 3. Which action failed?
npx playwright trace actions --errors-only

# 4. What went wrong?
npx playwright trace action 12

# 5. What did the page look like at that moment?
npx playwright trace snapshot 12

# 6. Query the DOM for more detail
npx playwright trace snapshot 12 -- eval "document.querySelector('.error-message').textContent"

# 7. Any relevant network failures?
npx playwright trace requests --failed

# 8. Any console errors?
npx playwright trace console --errors-only
```
