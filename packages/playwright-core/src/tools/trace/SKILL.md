---
name: playwright-trace
description: Inspect Playwright trace files from the command line — list actions, view requests, console, errors, snapshots and screenshots.
allowed-tools: Bash(npx:*)
---

# Playwright Trace CLI

Inspect `.zip` trace files produced by Playwright tests without opening a browser.

## Workflow

1. Start with `trace info` to understand what's in the trace.
2. Use `trace actions` to see all actions with their action IDs.
3. Use `trace action <action-id>` to drill into a specific action — see parameters, logs, source location, and available snapshots.
4. Use `trace requests`, `trace console`, or `trace errors` for cross-cutting views.
5. Use `trace snapshot` or `trace screenshot` to extract visual state.

## Commands

### Overview

```bash
# Trace metadata: browser, viewport, duration, action/error counts
npx playwright trace info <trace.zip>
```

### Actions

```bash
# List all actions as a tree with action IDs and timing
npx playwright trace actions <trace.zip>

# Filter by action title (regex, case-insensitive)
npx playwright trace actions --grep "click" <trace.zip>

# Only failed actions
npx playwright trace actions --errors-only <trace.zip>
```

### Action details

```bash
# Show full details for one action: params, result, logs, source, snapshots
npx playwright trace action <trace.zip> <action-id>
```

The `action` command displays available snapshot phases (before, input, after) and the exact command to extract them.

### Requests

```bash
# All network requests: method, status, URL, duration, size
npx playwright trace requests <trace.zip>

# Filter by URL pattern
npx playwright trace requests --grep "api" <trace.zip>

# Filter by HTTP method
npx playwright trace requests --method POST <trace.zip>

# Only failed requests (status >= 400)
npx playwright trace requests --failed <trace.zip>
```

### Request details

```bash
# Show full details for one request: headers, body, security
npx playwright trace request <trace.zip> <request-id>
```

### Console

```bash
# All console messages and stdout/stderr
npx playwright trace console <trace.zip>

# Only errors
npx playwright trace console --errors-only <trace.zip>

# Only browser console (no stdout/stderr)
npx playwright trace console --browser <trace.zip>

# Only stdout/stderr (no browser console)
npx playwright trace console --stdio <trace.zip>
```

### Errors

```bash
# All errors with stack traces and associated actions
npx playwright trace errors <trace.zip>
```

### Snapshots

```bash
# Save DOM snapshot as HTML (tries input, then before, then after)
npx playwright trace snapshot <trace.zip> <action-id> -o snapshot.html

# Save a specific phase
npx playwright trace snapshot --name before <trace.zip> <action-id> -o before.html
npx playwright trace snapshot --name after <trace.zip> <action-id> -o after.html

# Serve snapshot on localhost with resources
npx playwright trace snapshot --serve <trace.zip> <action-id>
```

### Screenshots

```bash
# Save the closest screencast frame for an action
npx playwright trace screenshot <trace.zip> <action-id> -o screenshot.png
```

### Attachments

```bash
# List all trace attachments
npx playwright trace attachments <trace.zip>

# Extract an attachment by its number
npx playwright trace attachment <trace.zip> 1
npx playwright trace attachment <trace.zip> 1 -o out.png
```

## Typical investigation

```bash
# 1. What happened in this trace?
npx playwright trace info test-results/my-test/trace.zip

# 2. What actions ran?
npx playwright trace actions test-results/my-test/trace.zip

# 3. Which action failed?
npx playwright trace actions --errors-only test-results/my-test/trace.zip

# 4. What went wrong?
npx playwright trace action test-results/my-test/trace.zip 12

# 5. What did the page look like?
npx playwright trace snapshot test-results/my-test/trace.zip 12 -o page.html

# 6. Any relevant network failures?
npx playwright trace requests --failed test-results/my-test/trace.zip

# 7. Any console errors?
npx playwright trace console --errors-only test-results/my-test/trace.zip
```
