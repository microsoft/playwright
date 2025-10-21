# 🎭 Playwright

[![npm version](https://img.shields.io/npm/v/playwright.svg)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge -->[![Chromium version](https://img.shields.io/badge/chromium-141.0.7390.37-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge -->[![Firefox version](https://img.shields.io/badge/firefox-142.0.1-blue.svg?logo=firefoxbrowser)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> <!-- GEN:webkit-version-badge -->[![WebKit version](https://img.shields.io/badge/webkit-26.0-blue.svg?logo=safari)](https://webkit.org/)<!-- GEN:stop --> [![Join Discord](https://img.shields.io/badge/join-discord-informational)](https://aka.ms/playwright/discord)

## [Documentation](https://playwright.dev) | [API reference](https://playwright.dev/docs/api/class-playwright)

Playwright is a framework for Web Testing and Automation. It allows testing [Chromium](https://www.chromium.org/Home), [Firefox](https://www.mozilla.org/en-US/firefox/new/) and [WebKit](https://webkit.org/) with a single API. Playwright is built to enable cross-browser web automation that is **ever-green**, **capable**, **reliable** and **fast**.

|          | Linux | macOS | Windows |
|   :---   | :---: | :---: | :---:   |
| Chromium <!-- GEN:chromium-version -->141.0.7390.37<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit <!-- GEN:webkit-version -->26.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox <!-- GEN:firefox-version -->142.0.1<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |

Headless execution is supported for all browsers on all platforms. Check out [system requirements](https://playwright.dev/docs/intro#system-requirements) for details.

Looking for Playwright for [Python](https://playwright.dev/python/docs/intro), [.NET](https://playwright.dev/dotnet/docs/intro), or [Java](https://playwright.dev/java/docs/intro)?

## Installation

Playwright has its own test runner for end-to-end tests, we call it Playwright Test.

### Using init command

The easiest way to get started with Playwright Test is to run the init command.

```Shell
# Run from your project's root directory
npm init playwright@latest
# Or create a new project
npm init playwright@latest new-project
```

This will create a configuration file, optionally add examples, a GitHub Action workflow and a first test example.spec.ts. You can now jump directly to writing assertions section.

### Manually

Add dependency and install browsers.

```Shell
npm i -D @playwright/test
# install supported browsers
npx playwright install
```

You can optionally install only selected browsers, see [install browsers](https://playwright.dev/docs/cli#install-browsers) for more details. Or you can install no browsers at all and use existing [browser channels](https://playwright.dev/docs/browsers).

* [Getting started](https://playwright.dev/docs/intro)
* [API reference](https://playwright.dev/docs/api/class-playwright)

## Capabilities

### Resilient • No flaky tests

**Auto-wait**. Playwright waits for elements to be actionable prior to performing actions. It also has a rich set of introspection events. The combination of the two eliminates the need for artificial timeouts - a primary cause of flaky tests.

**Web-first assertions**. Playwright assertions are created specifically for the dynamic web. Checks are automatically retried until the necessary conditions are met.

**Tracing**. Configure test retry strategy, capture execution trace, videos and screenshots to eliminate flakes.

### No trade-offs • No limits

Browsers run web content belonging to different origins in different processes. Playwright is aligned with the architecture of the modern browsers and runs tests out-of-process. This makes Playwright free of the typical in-process test runner limitations.

**Multiple everything**. Test scenarios that span multiple tabs, multiple origins and multiple users. Create scenarios with different contexts for different users and run them against your server, all in one test.

**Trusted events**. Hover elements, interact with dynamic controls and produce trusted events. Playwright uses real browser input pipeline indistinguishable from the real user.

Test frames, pierce Shadow DOM. Playwright selectors pierce shadow DOM and allow entering frames seamlessly.

### Full isolation • Fast execution

**Browser contexts**. Playwright creates a browser context for each test. Browser context is equivalent to a brand new browser profile. This delivers full test isolation with zero overhead. Creating a new browser context only takes a handful of milliseconds.

**Log in once**. Save the authentication state of the context and reuse it in all the tests. This bypasses repetitive log-in operations in each test, yet delivers full isolation of independent tests.

### Powerful Tooling

**[Codegen](https://playwright.dev/docs/codegen)**. Generate tests by recording your actions. Save them into any language.

**[Playwright inspector](https://playwright.dev/docs/inspector)**. Inspect page, generate selectors, step through the test execution, see click points and explore execution logs.

**[Trace Viewer](https://playwright.dev/docs/trace-viewer)**. Capture all the information to investigate the test failure. Playwright trace contains test execution screencast, live DOM snapshots, action explorer, test source and many more.

Looking for Playwright for [TypeScript](https://playwright.dev/docs/intro), [JavaScript](https://playwright.dev/docs/intro), [Python](https://playwright.dev/python/docs/intro), [.NET](https://playwright.dev/dotnet/docs/intro), or [Java](https://playwright.dev/java/docs/intro)?

## Examples

To learn how to run these Playwright Test examples, check out our [getting started docs](https://playwright.dev/docs/intro).

#### Page screenshot

This code snippet navigates to Playwright homepage and saves a screenshot.

```TypeScript
import { test } from '@playwright/test';

test('Page Screenshot', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.screenshot({ path: `example.png` });
});
```

#### Mobile and geolocation

This snippet emulates Mobile Safari on a device at given geolocation, navigates to maps.google.com, performs the action and takes a screenshot.

```TypeScript
import { test, devices } from '@playwright/test';

test.use({
  ...devices['iPhone 13 Pro'],
  locale: 'en-US',
  geolocation: { longitude: 12.492507, latitude: 41.889938 },
  permissions: ['geolocation'],
})

test('Mobile and geolocation', async ({ page }) => {
  await page.goto('https://maps.google.com');
  await page.getByText('Your location').click();
  await page.waitForRequest(/.*preview\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });
});
```

#### Evaluate in browser context

This code snippet navigates to example.com, and executes a script in the page context.

```TypeScript
import { test } from '@playwright/test';

test('Evaluate in browser context', async ({ page }) => {
  await page.goto('https://www.example.com/');
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    }
  });
  console.log(dimensions);
});
```

#### Intercept network requests

This code snippet sets up request routing for a page to log all network requests.

```TypeScript
import { test } from '@playwright/test';

test('Intercept network requests', async ({ page }) => {
  // Log and continue all network requests
  await page.route('**', route => {
    console.log(route.request().url());
    route.continue();
  });
  await page.goto('http://todomvc.com');
});
```

## Custom Modifications for MCP Server

This fork includes custom enhancements for the Playwright MCP (Model Context Protocol) server:

### Features Added

#### 1. Custom SSE Path Support
- **New CLI flag**: `--sse-path <path>` allows customizing the SSE endpoint path (default: `/sse`)
- **Files modified**:
  - `packages/playwright/src/mcp/program.ts` - Added CLI option
  - `packages/playwright/src/mcp/config.d.ts` - Added config type
  - `packages/playwright/src/mcp/sdk/http.ts` - Dynamic SSE path handling
  - `packages/playwright/src/mcp/sdk/server.ts` - Pass config through chain
  - `packages/playwright/src/mcp/browser/config.ts` - Wire CLI to config

#### 2. Native Health Endpoint
- **Endpoint**: `GET /health` returns `{"status":"healthy"}`
- **Location**: Built into the HTTP server (`sdk/http.ts:96-102`)
- **No proxy needed**: Health checks are handled directly by the MCP server

#### 3. Verbose Logging Flag
- **New CLI flag**: `--verbose` automatically enables HTTP request logging
- **No DEBUG env needed**: Simply add `--verbose` to command line
- **Files modified**: `packages/playwright/src/mcp/program.ts` - Auto-enable debug logs

### Development Mode

#### Quick Start

```bash
# 1. Install dependencies
npm ci

# 2. Build the project
npm run build

# 3. Install browsers
cd packages/playwright
npx playwright install chromium

# 4. Run MCP server with custom SSE path and verbose logging
node cli.js run-mcp-server --headless --port 8018 --sse-path /custom-path --verbose

# 5. Test health endpoint (in another terminal)
curl http://localhost:8018/health
# Response: {"status":"healthy"}

# 6. Test SSE endpoint
curl http://localhost:8018/custom-path
```

#### Development Workflow

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# In another terminal, run the server with verbose logging
cd packages/playwright
node cli.js run-mcp-server --headless --port 8018 --verbose

# Run MCP tests
npm run test-mcp

# Type checking
npm run tsc

# Linting
npm run lint
```

#### Available Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run watch` | Watch mode with auto-rebuild |
| `npm run test-mcp` | Run MCP-specific tests |
| `npm run tsc` | TypeScript compilation check |
| `npm run lint` | Full linting (eslint + tsc + doc) |

### Production Build with Docker

For production deployment, use the Docker build located in the parent directory (`../../`):

```bash
# Navigate to custom-servers/playwright directory
cd ../../

# Build Docker image with the build script
./build_playwright_linux.sh

# Or build manually (requires playwright/ directory)
docker build -f Dockerfile -t playwright-mcp:latest .

# Run with default SSE path
docker run -d --name playwright-mcp -p 8018:8018 \
  playwright-mcp:latest --headless --browser chromium

# Run with custom SSE path
docker run -d --name playwright-mcp -p 8018:8018 \
  playwright-mcp:latest \
    --headless \
    --browser chromium \
    --sse-path /my-playwright \
    --port 18018

# Test health endpoint
curl http://localhost:8018/health

# View logs
docker logs -f playwright-mcp

# Stop and remove
docker stop playwright-mcp && docker rm playwright-mcp
```

#### Docker Build Features

- **Multi-stage build**: Optimized for size (~1.5GB vs ~2GB source)
- **Chromium only**: Smaller footprint (excludes Firefox/WebKit)
- **Production dependencies**: No dev dependencies included
- **Health proxy**: Optional proxy for path rewriting (see `health_proxy.js`)
- **Auto-restart**: Use `--restart unless-stopped` for production

### MCP Server Configuration

#### CLI Options

```bash
node cli.js run-mcp-server [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--port <port>` | Port to listen on for SSE transport | stdio |
| `--sse-path <path>` | Custom SSE endpoint path | `/sse` |
| `--host <host>` | Host to bind server to | `localhost` |
| `--verbose` | Enable verbose logging for HTTP requests | false |
| `--headless` | Run browser in headless mode | false |
| `--browser <browser>` | Browser to use (`chromium`, `firefox`, `webkit`) | `chromium` |
| `--isolated` | Keep browser profile in memory | false |
| `--no-sandbox` | Disable sandbox (required in Docker) | false |

#### Example Usage

```bash
# Basic SSE server
node cli.js run-mcp-server --headless --port 8018

# With verbose logging
node cli.js run-mcp-server --headless --port 8018 --verbose

# Custom SSE path with verbose logging
node cli.js run-mcp-server --headless --port 8018 --sse-path /playwright-sse --verbose

# Production settings with logging
node cli.js run-mcp-server \
  --headless \
  --browser chromium \
  --port 8018 \
  --sse-path /mcp \
  --isolated \
  --no-sandbox \
  --verbose
```

### Logging and Debugging

The MCP server includes comprehensive HTTP request logging for monitoring in development and production.

#### Enable Verbose Logging

**Simple Method (Recommended):**
```bash
# Use --verbose flag to automatically enable HTTP logging
node cli.js run-mcp-server --headless --port 8018 --verbose

# With custom SSE path
node cli.js run-mcp-server --headless --port 8018 --sse-path /custom --verbose
```

**Advanced Method (Environment Variable):**
```bash
# Enable all MCP logs
DEBUG=pw:mcp:* node cli.js run-mcp-server --headless --port 8018

# Enable HTTP logs only
DEBUG=pw:mcp:http node cli.js run-mcp-server --headless --port 8018

# Combine with --verbose for additional categories
DEBUG=pw:mcp:test,pw:mcp:server node cli.js run-mcp-server --headless --port 8018 --verbose
```

**Docker:**
```bash
# Use --verbose flag
docker run -d --name playwright-mcp -p 8018:8018 \
  playwright-mcp:latest --headless --verbose

# Or use DEBUG environment variable
docker run -d --name playwright-mcp -p 8018:8018 \
  -e DEBUG=pw:mcp:http \
  playwright-mcp:latest --headless
```

#### Log Categories

| Category | Description | Example Output |
|----------|-------------|----------------|
| `pw:mcp:http` | HTTP requests, responses, sessions | `[GET] /health - Client: ::1` |
| `pw:mcp:test` | Test and session lifecycle | `create SSE session: abc-123` |
| `pw:mcp:server` | Server operations | `listTools`, `callTool` |

#### Example Log Output

```bash
# Server startup
pw:mcp:http Starting HTTP server - Host: localhost, Port: 8018
pw:mcp:http HTTP server started successfully - Listening on: http://localhost:8018
pw:mcp:http Installing HTTP transport - URL: http://localhost:8018, SSE Path: /sse
pw:mcp:http Allowed hosts: localhost:8018

# Health check request
pw:mcp:http [GET] /health - Client: ::1
pw:mcp:http [HEALTH] Health check requested - Client: ::1
pw:mcp:http [200] /health - 2ms - Client: ::1

# SSE session lifecycle
pw:mcp:http [GET] /sse - Client: ::1
pw:mcp:http [SSE] SSE endpoint accessed: /sse - Client: ::1
pw:mcp:http [SSE-GET] New SSE session created: abc-123 - Client: ::1 - Total sessions: 1
pw:mcp:http [SSE-GET] Session closed: abc-123 - Client: ::1 - Remaining sessions: 0

# Custom SSE path
pw:mcp:http [GET] /my-custom-path - Client: ::1
pw:mcp:http [SSE] SSE endpoint accessed: /my-custom-path - Client: ::1
```

#### Logged Information

All HTTP requests log:
- **HTTP Method** and **Path**
- **Client IP address**
- **Request duration** (in milliseconds)
- **Session IDs** for SSE/MCP sessions
- **Active session count**
- **Error details** (missing params, not found, etc.)

#### Production Monitoring

```bash
# Save logs to file using --verbose
node cli.js run-mcp-server --headless --port 8018 --verbose 2>&1 | tee mcp-server.log

# Or use DEBUG environment variable
DEBUG=pw:mcp:http node cli.js run-mcp-server --headless --port 8018 2>&1 | tee mcp-server.log

# Filter specific endpoint logs
docker logs playwright-mcp 2>&1 | grep -E "\[HEALTH\]|\[SSE\]"

# Monitor real-time logs (with --verbose in Docker CMD)
docker logs -f playwright-mcp
```

### Troubleshooting

**Build fails with "Cannot find module './lib/program'"**
- Run `npm run build` before using the CLI

**Browser installation fails**
- Ensure you're in `packages/playwright/` directory
- Run `npx playwright install chromium`

**TypeScript errors after modifications**
- Run `npm run tsc` to check for type errors
- Check `config.d.ts` for type definitions

**Docker build fails with "playwright directory not found"**
- Run `./build_playwright_linux.sh` which handles cloning
- Or manually clone: `git clone https://github.com/microsoft/playwright.git && cd playwright && git checkout 54c7115`

**Logs not appearing**
- Ensure `DEBUG=pw:mcp:http` environment variable is set
- Check that you're redirecting stderr: `2>&1` or `2>&1 | tee log.txt`
- In Docker, use `docker logs` command to view output

## Resources

* [Documentation](https://playwright.dev)
* [API reference](https://playwright.dev/docs/api/class-playwright/)
* [Contribution guide](CONTRIBUTING.md)
* [Changelog](https://github.com/microsoft/playwright/releases)
