# Running Playwright Tests

To run Playwright tests, use the `npx playwright test` command, or a package manager script. To avoid opening the interactive html report, use `PLAYWRIGHT_HTML_OPEN=never` environment variable.

```bash
# Run all tests
PLAYWRIGHT_HTML_OPEN=never npx playwright test

# Run all tests through a custom npm script
PLAYWRIGHT_HTML_OPEN=never npm run special-test-command
```

# Debugging Playwright Tests

To debug a failing test, run it with Playwright as usual, but append `--debug=cli` option. This command will pause the test at the point of failure, and print the "socket path" and instructions.

IMPORTANT: run the command in the background and check the output until instructions are available.

Once instructions are printed, attach a test session to `playwright-cli` and use it to explore the page.

```bash
# Choose a name (e.g. test1) and attach
playwright-cli --session=test1 attach '<socket path>'

# Explore the page and interact if needed
playwright-cli --session=test1 snapshot
playwright-cli --session=test1 click e14
```

Keep the test running in the background while you explore and look for a fix. After fixing the test, stop the background test run.

Every action you perform with `playwright-cli` generates corresponding Playwright TypeScript code.
This code appears in the output and can be copied directly into the test. Most of the time, a specific locator or an expectation should be updated.

## Example Workflow

```bash
# Run tests in background:
npx playwright test --grep "failing test title" --debug=cli
# ... and wait for the debugging instructions

# Attach test session
playwright-cli --session=test1 attach '/path/to/socket/file'
# Take a snapshot to explore the page
playwright-cli --session=test1 snapshot
# Find the right button to click, and perform the action to verify it works as expected
playwright-cli --session=test1 click e17

# Update locator in the test file, based on "Ran Playwright code" snippets
```
