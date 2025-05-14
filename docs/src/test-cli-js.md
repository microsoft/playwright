---
id: test-cli
title: "Command line"
---

Playwright provides a powerful command line interface for running tests, generating code, debugging, and more. The most up to date list of commands and arguments available on the CLI can always be retrieved via `npx playwright --help`.

## Standard Operation

### Run Tests

Run your Playwright tests. [Read more about running tests](./running-tests.md).

#### Syntax

```bash
npx playwright test [options] [test-filter...]
```

#### Common Options

| Option | Description |
| :--- | :--- |
| `--debug` | Run tests with Playwright Inspector. Shortcut for `PWDEBUG=1` environment variable and `--timeout=0 --max-failures=1 --headed --workers=1` options. |
| `--headed` | Run tests in headed browsers (default: headless). |
| `-g <grep>` or `--grep <grep>` | Only run tests matching this regular expression (default: ".*"). |
| `--project <project-name...>` | Only run tests from the specified list of projects, supports '*' wildcard (default: run all projects). |
| `--ui` | Run tests in interactive UI mode. |
| `-u` or `--update-snapshots [mode]` | Update snapshots with actual results. Possible values are "all", "changed", "missing", and "none". Running tests without the flag defaults to "missing"; running tests with the flag but without a value defaults to "changed". |
| `-j <workers>` or `--workers <workers>` | Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%). |

#### All Options

| Option | Description |
| :--- | :--- |
| Non-option arguments | Each argument is treated as a regular expression matched against the full test file path. Only tests from files matching the pattern will be executed. Special symbols like `$` or `*` should be escaped with `\`. In many shells/terminals you may need to quote the arguments. |
| `-c <file>` or `--config <file>` | Configuration file, or a test directory with optional "playwright.config.&#123;m,c&#125;?&#123;js,ts&#125;". Defaults to `playwright.config.ts` or `playwright.config.js` in the current directory. |
| `--debug` | Run tests with Playwright Inspector. Shortcut for `PWDEBUG=1` environment variable and `--timeout=0 --max-failures=1 --headed --workers=1` options. |
| `--fail-on-flaky-tests` | Fail if any test is flagged as flaky (default: false). |
| `--forbid-only` | Fail if `test.only` is called (default: false). Useful on CI. |
| `--fully-parallel` | Run all tests in parallel (default: false). |
| `--global-timeout <timeout>` | Maximum time this test suite can run in milliseconds (default: unlimited). |
| `-g <grep>` or `--grep <grep>` | Only run tests matching this regular expression (default: ".*"). |
| `-gv <grep>` or `--grep-invert <grep>` | Only run tests that do not match this regular expression. |
| `--headed` | Run tests in headed browsers (default: headless). |
| `--ignore-snapshots` | Ignore screenshot and snapshot expectations. |
| `-j <workers>` or `--workers <workers>` | Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%). |
| `--last-failed` | Only re-run the failures. |
| `--list` | Collect all the tests and report them, but do not run. |
| `--max-failures <N>` or `-x` | Stop after the first `N` failures. Passing `-x` stops after the first failure. |
| `--no-deps` | Do not run project dependencies. |
| `--output <dir>` | Folder for output artifacts (default: "test-results"). |
| `--only-changed [ref]` | Only run test files that have been changed between 'HEAD' and 'ref'. Defaults to running all uncommitted changes. Only supports Git. |
| `--pass-with-no-tests` | Makes test run succeed even if no tests were found. |
| `--project <project-name...>` | Only run tests from the specified list of projects, supports '*' wildcard (default: run all projects). |
| `--quiet` | Suppress stdio. |
| `--repeat-each <N>` | Run each test `N` times (default: 1). |
| `--reporter <reporter>` | Reporter to use, comma-separated, can be "dot", "line", "list", or others (default: "list"). You can also pass a path to a custom reporter file. |
| `--retries <retries>` | Maximum retry count for flaky tests, zero for no retries (default: no retries). |
| `--shard <shard>` | Shard tests and execute only the selected shard, specified in the form "current/all", 1-based, e.g., "3/5". |
| `--timeout <timeout>` | Specify test timeout threshold in milliseconds, zero for unlimited (default: 30 seconds). |
| `--trace <mode>` | Force tracing mode, can be `on`, `off`, `on-first-retry`, `on-all-retries`, `retain-on-failure`, `retain-on-first-failure`. |
| `--tsconfig <path>` | Path to a single tsconfig applicable to all imported files (default: look up tsconfig for each imported file separately). |
| `--ui` | Run tests in interactive UI mode. |
| `--ui-host <host>` | Host to serve UI on; specifying this option opens UI in a browser tab. |
| `--ui-port <port>` | Port to serve UI on, 0 for any free port; specifying this option opens UI in a browser tab. |
| `-u` or `--update-snapshots [mode]` | Update snapshots with actual results. Possible values are "all", "changed", "missing", and "none". Running tests without the flag defaults to "missing"; running tests with the flag but without a value defaults to "changed". |
| `--update-source-method [mode]` | Update snapshots with actual results. Possible values are "patch" (default), "3way" and "overwrite". "Patch" creates a unified diff file that can be used to update the source code later. "3way" generates merge conflict markers in source code. "Overwrite" overwrites the source code with the new snapshot values.|
| `-x` | Stop after the first failure. |

#### Examples

```bash
# Run all tests
npx playwright test

# Run a single test file
npx playwright test tests/todo-page.spec.ts

# Run a set of test files
npx playwright test tests/todo-page/ tests/landing-page/

# Run files by name pattern
npx playwright test my-spec my-spec-2

# Run tests at a specific line
npx playwright test my-spec.ts:42

# Run tests by title
npx playwright test -g "add a todo item"

# Run tests in headed browsers
npx playwright test --headed

# Run tests for a specific project
npx playwright test --project=chromium

# Get help
npx playwright test --help
```

**Disable [parallelization](./test-parallel.md)**

```bash
npx playwright test --workers=1
```

**Choose a [reporter](./test-reporters.md)**

```bash
npx playwright test --reporter=dot
```

**Run in debug mode with [Playwright Inspector](./debug.md)**

```bash
npx playwright test --debug
```

**Run tests in interactive [UI mode](./test-ui-mode.md)**

```bash
npx playwright test --ui
```

### Show Report

Display HTML report from previous test run. [Read more about the HTML reporter](./test-reporters#html-reporter).

#### Syntax

```bash
npx playwright show-report [report] [options]
```

#### Options

| Option | Description |
| :--- | :--- |
| `--host <host>` | Host to serve report on (default: localhost) |
| `--port <port>` | Port to serve report on (default: 9323) |

#### Examples

```bash
# Show latest test report
npx playwright show-report

# Show a specific report
npx playwright show-report playwright-report/

# Show report on custom port
npx playwright show-report --port 8080
```

### Install Browsers

Install browsers required by Playwright.

#### Syntax

```bash
npx playwright install [options] [browser...]
npx playwright install-deps [options] [browser...]
npx playwright uninstall
```

#### Install Options

| Option | Description |
| :--- | :--- |
| `--force` | Force reinstall of stable browser channels |
| `--with-deps` | Install browser system dependencies |
| `--dry-run` | Don't perform installation, just print information |
| `--only-shell` | Only install chromium-headless-shell instead of full Chromium |
| `--no-shell` | Don't install chromium-headless-shell |

#### Install Deps Options

| Option | Description |
| :--- | :--- |
| `--dry-run` | Don't perform installation, just print information |

#### Examples

```bash
# Install all browsers
npx playwright install

# Install only Chromium
npx playwright install chromium

# Install specific browsers
npx playwright install chromium webkit

# Install browsers with dependencies
npx playwright install --with-deps
```

## Generation & Debugging Tools

### Code Generation

Record actions and generate tests for multiple languages. [Read more about Codegen](./codegen-intro.md).

#### Syntax

```bash
npx playwright codegen [options] [url]
```

#### Options

| Option | Description |
| :--- | :--- |
| `-b, --browser <name>` | Browser to use: chromium, firefox, or webkit (default: chromium) |
| `-o, --output <file>` | Output file for the generated script |
| `--target <language>` | Language to use: javascript, playwright-test, python, etc. |
| `--test-id-attribute <attr>` | Attribute to use for test IDs |

#### Examples

```bash
# Start recording with interactive UI
npx playwright codegen

# Record on specific site
npx playwright codegen https://playwright.dev

# Generate Python code
npx playwright codegen --target=python
```

### Trace Viewer

Analyze and view test traces for debugging. [Read more about Trace Viewer](./trace-viewer.md).

#### Syntax

```bash
npx playwright show-trace [options] [trace...]
```

#### Options

| Option | Description |
| :--- | :--- |
| `-b, --browser <name>` | Browser to use: chromium, firefox, or webkit (default: chromium) |
| `-h, --host <host>` | Host to serve trace on |
| `-p, --port <port>` | Port to serve trace on |

#### Examples

```bash
# View a trace file
npx playwright show-trace trace.zip

# View trace from directory
npx playwright show-trace trace/
```

## Specialized Commands

### Merge Reports

Read [blob](./test-reporters#blob-reporter) reports and combine them. [Read more about merge-reports](./test-sharding.md).

#### Syntax

```bash
npx playwright merge-reports [options] [blob dir]
```

#### Options

| Option | Description |
| :--- | :--- |
| `-c, --config <file>` | Configuration file. Can be used to specify additional configuration for the output report |
| `--reporter <reporter>` | Reporter to use, comma-separated, can be "list", "line", "dot", "json", "junit", "null", "github", "html", "blob" (default: "list") |

#### Examples

```bash
# Combine test reports
npx playwright merge-reports ./reports
```

### Clear Cache

Clear all Playwright caches.

#### Syntax

```bash
npx playwright clear-cache
```


### Image Screenshot

Capture screenshot of a particular website. Uses [`method: Page.screenshot`] to generate the screenshot.

#### Syntax

```bash
npx playwright screenshot [options] <url> <filename>
```

#### Options

| Option | Description |
| :--- | :--- |
| `-b, --browser <name>` | Browser to use: chromium, firefox, or webkit (default: chromium) |
| `--wait-for-selector <selector>` | Wait for element matching selector before capturing |
| `--wait-for-timeout <timeout>` | Wait for timeout in milliseconds before capturing |
| `--full-page` | Capture full scrollable page, not just viewport |

#### Examples

```bash
# Take screenshot of website
npx playwright screenshot https://playwright.dev example.png

# Full page screenshot
npx playwright screenshot --full-page https://github.com github.png
```

### PDF Screenshot

Generate PDF documents from websites. Uses [`method: Page.pdf`] to generate the PDF.

#### Syntax

```bash
npx playwright pdf [options] <url> <filename>
```

#### Options

| Option | Description |
| :--- | :--- |
| `-b, --browser <name>` | Browser to use: chromium (only Chromium supported) |
| `--wait-for-selector <selector>` | Wait for element matching selector before capturing |
| `--paper-format <format>` | Paper format: Letter, A4, etc. (default: Letter) |
| `--landscape` | Set landscape paper orientation |

#### Examples

```bash
# Generate PDF of website
npx playwright pdf https://playwright.dev doc.pdf

# Use A4 paper format
npx playwright pdf --paper-format=A4 https://playwright.dev doc.pdf
```

### Playwright Server

Start a remote server for Playwright automation.

#### Syntax

```bash
npx playwright run-server [options]
```

#### Options

| Option | Description |
| :--- | :--- |
| `--port <port>` | Server port |
| `--host <host>` | Server host |
| `--path <path>` | Endpoint path (default: /) |
| `--max-clients <number>` | Maximum number of client connections |
| `--mode <mode>` | Server mode: "default" or "extension" |

#### Examples

```bash
# Start with default settings
npx playwright run-server

# Start on custom port
npx playwright run-server --port 8080

# Run in extension mode
npx playwright run-server --mode extension
```
