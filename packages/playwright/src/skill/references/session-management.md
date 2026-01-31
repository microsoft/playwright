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

# Stop a specific session
playwright-cli session-stop mysession

# Stop all sessions
playwright-cli session-stop-all

# Restart a session (useful after version updates)
playwright-cli session-restart mysession

# Delete session data (cookies, storage, etc.)
playwright-cli session-delete mysession
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
playwright-cli --session=site1 close
playwright-cli --session=site2 close
playwright-cli --session=site3 close
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

### Testing without persistent profile

Use `--in-memory` flag to keep the browser profile in memory only:

```bash
# Session data won't persist to disk
playwright-cli --in-memory open https://example.com
```

## Default Session

When `--session` is omitted, commands use the default session:

```bash
# These use the same default session
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli close  # Closes default session
```

## Session Configuration

Configure a session with specific settings:

```bash
# Configure session with config file
playwright-cli --session=mysession config --config=playwright-cli.json

# Configure session with specific browser
playwright-cli --session=mysession config --browser=firefox

# Configure session in headed mode
playwright-cli --session=mysession config --headed

# Restart session to apply changes
playwright-cli session-restart mysession
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
playwright-cli session-stop auth
playwright-cli session-stop scrape

# Or stop all at once
playwright-cli session-stop-all
```

### 3. Delete Stale Session Data

```bash
# Remove old session data to free disk space
playwright-cli session-delete oldsession
```
