---
name: playwright-trace
description: Inspect Playwright trace files from the command line — list actions, view requests, console, errors, snapshots and screenshots, and find requests still pending when an action started or finished to diagnose race conditions behind flaky tests.
allowed-tools: Bash(npx:*)
---

# Playwright Trace CLI

Inspect `.zip` trace files produced by Playwright tests without opening a browser.

## Workflow

1. Start with `trace open <trace.zip>` to extract the trace and see its metadata.
2. Use `trace actions` to see all actions with their action IDs.
3. Use `trace action <action-id>` to drill into a specific action — see parameters, logs, source location, and available snapshots.
4. Use `trace requests`, `trace console`, or `trace errors` for cross-cutting views.
   For a flaky or timing-dependent failure, use `trace actions --pending` to find actions
   that ran while requests were still outstanding.
5. Use `trace snapshot <action-id>` to get the DOM snapshot, or run a browser command against it.
6. Use `trace close` to remove the extracted trace data when done.

All commands after `open` operate on the currently opened trace — no need to pass the trace file again. Opening a new trace replaces the previous one.

## Commands

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

# Only actions that ran while requests were pending (see "Pending requests")
npx playwright trace actions --pending
```

### Action details

```bash
# Show full details for one action: params, result, logs, source, snapshots
npx playwright trace action <action-id>
```

The `action` command displays available snapshot phases (before, input, after) and the exact command to extract them.

### Requests

```bash
# All network requests: method, status, URL, duration, size
npx playwright trace requests

# Filter by URL pattern
npx playwright trace requests --grep "api"

# Filter by HTTP method
npx playwright trace requests --method POST

# Only failed requests (status >= 400)
npx playwright trace requests --failed

# Only requests still pending at an action (see "Pending requests")
npx playwright trace requests --pending-at <action-id>
```

### Request details

```bash
# Show full details for one request: headers, body, security
npx playwright trace request <request-id>
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
```

### Errors

```bash
# All errors with stack traces and associated actions
npx playwright trace errors
```

### Pending requests

Requests that had started but not finished at the moment an action ran. This is the main
tool for diagnosing races — an action that ran while the page was still loading data is the
usual cause of a flaky click, a stale assertion, or an element that moved.

```bash
# Which requests were still pending when this action started?
npx playwright trace requests --pending-at <action-id>

# ...and which were still unresolved when it finished?
npx playwright trace requests --pending-at <action-id> --phase end

# Every action that ran while requests were pending
npx playwright trace actions --pending
npx playwright trace actions --pending --phase end

# Composes with the usual request filters
npx playwright trace requests --pending-at <action-id> --grep "api"
```

`Overhang` (per action) and `Longest` (summary) report how long the request kept running
*after* the reference moment — the size of the race window. A large overhang on the action
that failed is strong evidence the test acted before the page had settled. `never` means the
request had not completed by the end of the trace.

Failed and aborted requests (including anything stopped by `route.abort()`) carry no end time
in the trace, so whether they were still running cannot be determined. They are reported as a
count rather than guessed at — use `trace requests --failed` to see them.

```
   # Method   Status   Name                    Started   Overhang
   2. GET      200      cart                    -326ms       1.2s
```

Read this as: `/api/cart` began 326ms before the action and continued for 1.2s after it —
so the action ran against a page that was still 1.2s away from having its cart data. The `#`
column is the same request ordinal `trace requests` uses, so `trace request 2` drills in.

### Start vs. end

The two phases answer different questions, and the failure usually shows up in one of them:

- **`--phase start` (default)** — *did we act too early?* Requests pending when the action
  began mean the page was still filling in. Explains a click landing on a stale element, or
  a locator resolving to the wrong node.
- **`--phase end`** — *did we move on too early?* Requests still unresolved when the action
  returned mean the **next** step starts in a racy state. Explains an assertion right after
  a click that reads pre-update content.

At `--phase end` an extra `Origin` column separates the two causes:

```
   # Method   Status   Name        Started   Overhang Origin
   2. GET      200      cart        -593ms       2.1s before
   4. GET      200      add            -2ms       1.9s during
```

- `before` — the request predated the action; the page never settled in the first place.
  Fix by waiting for the app to reach a known state before acting.
- `during` — the action itself triggered the request and returned without waiting for it.
  This is the classic "clicked, then asserted immediately" bug: assert on an observable
  post-condition (`expect(...).toHaveText(...)`, a response wait) rather than the click
  returning.

### Snapshots

The `snapshot` command loads the DOM snapshot for an action into a headless browser and runs a single browser command against it. Without a browser command, it returns the accessibility snapshot.

```bash
# Get the accessibility snapshot (default)
npx playwright trace snapshot <action-id>

# Use a specific phase
npx playwright trace snapshot <action-id> --name before

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

# 9. Did it act before the page settled? (races behind flaky failures)
npx playwright trace requests --pending-at 12

# 10. Did it move on before the work it started had finished?
npx playwright trace requests --pending-at 12 --phase end
```
