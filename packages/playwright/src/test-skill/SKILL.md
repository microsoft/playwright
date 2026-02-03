---
name: playwright-test
description: Run and debug Playwright tests. Use when the user needs to execute Playwright test files, run specific test cases, or debug failing tests.
allowed-tools: "Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)"
---

# Running Playwright Tests

To run Playwright tests, use the `npx playwright test` command, or a package manager script. To avoid opening the interactive html report, use `PLAYWRIGHT_HTML_OPEN=never` environment variable.

```bash
# Run all tests
PLAYWRIGHT_HTML_OPEN=never npx playwright test

# Run all tests through a custom npm script
PLAYWRIGHT_HTML_OPEN=never npm run special-test-command
```

# Debugging Playwright Tests

To debug a failing test, run it with Playwright as usual, but append `--debug=cli` option and run the command in the background. This command will pause the test at the point of failure, and print the "socket path" and instructions.

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
# Run in background:
npx playwright test --grep "failing test title" --debug=cli
# ...
# ### Paused on test error
# TimeoutError: locator.click: Timeout 5000ms exceeded.
# ...
# await page.getByRole('button', { name: 'Get help' }).click()
# ...
# ### Instructions
# - Use "playwright-cli --session=<name> attach '/path/to/socket/file'" to add a session.

# Attach test session
playwright-cli --session=test1 attach '/path/to/socket/file'

# Take a snapshot to see elements
playwright-cli --session=test1 snapshot
# Output shows: e17 [button "Get started"]

# Click the right button
playwright-cli --session=test1 click e17
# Ran Playwright code:
# await page.getByRole('button', { name: 'Get started' }).click();

# Update locator in the test
# - await page.getByRole('button', { name: 'Get help' }).click()
# + await page.getByRole('button', { name: 'Get started' }).click()
```
