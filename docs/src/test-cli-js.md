---
id: test-cli
title: "Command line"
---

## Introduction

Here are the most common options available in the command line.

- Run all the tests
  ```bash
  npx playwright test
  ```

- Run a single test file
  ```bash
  npx playwright test tests/todo-page.spec.ts
  ```

- Run a set of test files
  ```bash
  npx playwright test tests/todo-page/ tests/landing-page/
  ```

- Run files that have `my-spec` or `my-spec-2` in the file name
  ```bash
  npx playwright test my-spec my-spec-2
  ```

- Run tests that are in line 42 in my-spec.ts
  ```bash
  npx playwright test my-spec.ts:42
  ```

- Run the test with the title
  ```bash
  npx playwright test -g "add a todo item"
  ```

- Run tests in headed browsers
  ```bash
  npx playwright test --headed
  ```

- Run all the tests against a specific project
  ```bash
  npx playwright test --project=chromium
  ```

- Disable [parallelization](./test-parallel.md)
  ```bash
  npx playwright test --workers=1
  ```

- Choose a [reporter](./test-reporters.md)
  ```bash
  npx playwright test --reporter=dot
  ```

- Run in debug mode with [Playwright Inspector](./debug.md)
  ```bash
  npx playwright test --debug
  ```

- Run tests in interactive UI mode, with a built-in watch mode (Preview)
  ```bash
  npx playwright test --ui
  ```

- Ask for help
  ```bash
  npx playwright test --help
  ```

## Reference

Complete set of Playwright Test options is available in the [configuration file](./test-use-options.md). Following options can be passed to a command line and take priority over the configuration file:

<!-- // Note: packages/playwright/src/program.ts is the source of truth. -->

| Option | Description |
| :- | :- |
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
| `--trace <mode>` | Force tracing mode, can be "on", "off", "on-first-retry", "on-all-retries", "retain-on-failure", "retain-on-first-failure". |
| `--tsconfig <path>` | Path to a single tsconfig applicable to all imported files (default: look up tsconfig for each imported file separately). |
| `--ui` | Run tests in interactive UI mode. |
| `--ui-host <host>` | Host to serve UI on; specifying this option opens UI in a browser tab. |
| `--ui-port <port>` | Port to serve UI on, 0 for any free port; specifying this option opens UI in a browser tab. |
| `-u` or `--update-snapshots [mode]` | Update snapshots with actual results. Possible values are "all", "changed", "missing", and "none". Running tests without the flag defaults to "missing"; running tests with the flag but without a value defaults to "changed". |
| `--update-source-method [mode]` | Update snapshots with actual results. Possible values are "patch" (default), "3way" and "overwrite". "Patch" creates a unified diff file that can be used to update the source code later. "3way" generates merge conflict markers in source code. "Overwrite" overwrites the source code with the new snapshot values.|
| `-j <workers>` or `--workers <workers>` | Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%). |
| `-x` | Stop after the first failure. |
