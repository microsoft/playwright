# Session Management

Run multiple isolated browser sessions concurrently with state persistence.

## Named Sessions

Use `--session` flag to isolate browser contexts:

```bash
# Session 1: Authentication flow
playwright-cli --session=auth open https://app.example.com/login

# Session 2: Public browsing (separate cookies, storage)
playwright-cli --session=public open https://example.com

# Commands are isolated by session
playwright-cli --session=auth fill e1 "user@example.com"
playwright-cli --session=public snapshot
```

## Session Isolation Properties

Each session has independent:
- Cookies
- LocalStorage / SessionStorage
- IndexedDB
- Cache
- Browsing history
- Open tabs

## Session Commands

```bash
# List all sessions
playwright-cli session-list

# Stop a session (close the browser)
playwright-cli close                      # stop the default session
playwright-cli --session=mysession close  # stop a named session

# Stop all sessions
playwright-cli session-close-all

# Forcefully kill all daemon processes (for stale/zombie processes)
playwright-cli session-kill-all

# Delete session user data (profile directory)
playwright-cli delete-data                      # delete default session data
playwright-cli --session=mysession delete-data  # delete named session data
```

## Environment Variable

Set a default session name via environment variable:

```bash
export PLAYWRIGHT_CLI_SESSION="mysession"
playwright-cli open example.com  # Uses "mysession" automatically
```

## Common Patterns

### Concurrent Scraping

```bash
#!/bin/bash
# Scrape multiple sites concurrently

# Start all sessions
playwright-cli --session=site1 open https://site1.com &
playwright-cli --session=site2 open https://site2.com &
playwright-cli --session=site3 open https://site3.com &
wait

# Take snapshots from each
playwright-cli --session=site1 snapshot
playwright-cli --session=site2 snapshot
playwright-cli --session=site3 snapshot

# Cleanup
playwright-cli session-close-all
```

### A/B Testing Sessions

```bash
# Test different user experiences
playwright-cli --session=variant-a open "https://app.com?variant=a"
playwright-cli --session=variant-b open "https://app.com?variant=b"

# Compare
playwright-cli --session=variant-a screenshot
playwright-cli --session=variant-b screenshot
```

### Persistent Profile

By default, browser profile is kept in memory only. Use `--persistent` flag on `open` to persist the browser profile to disk:

```bash
# Use persistent profile (auto-generated location)
playwright-cli open https://example.com --persistent

# Use persistent profile with custom directory
playwright-cli open https://example.com --profile=/path/to/profile
```

## Default Session

When `--session` is omitted, commands use the default session:

```bash
# These use the same default session
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli close  # Stops default session
```

## Session Configuration

Configure a session with specific settings when opening:

```bash
# Open with config file
playwright-cli open https://example.com --config=.playwright/my-cli.json

# Open with specific browser
playwright-cli open https://example.com --browser=firefox

# Open in headed mode
playwright-cli open https://example.com --headed

# Open with persistent profile
playwright-cli open https://example.com --persistent
```

## Best Practices

### 1. Name Sessions Semantically

```bash
# GOOD: Clear purpose
playwright-cli --session=github-auth open https://github.com
playwright-cli --session=docs-scrape open https://docs.example.com

# AVOID: Generic names
playwright-cli --session=s1 open https://github.com
```

### 2. Always Clean Up

```bash
# Stop sessions when done
playwright-cli --session=auth close
playwright-cli --session=scrape close

# Or stop all at once
playwright-cli session-close-all

# If sessions become unresponsive or zombie processes remain
playwright-cli session-kill-all
```

### 3. Delete Stale Session Data

```bash
# Remove old session data to free disk space
playwright-cli --session=oldsession delete-data
```
