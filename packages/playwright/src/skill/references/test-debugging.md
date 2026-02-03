# Test Debugging

Debug Playwright tests automatically as you interact with the browser.

## How It Works

To debug a failing test, run it with playwright as usual, but append `--debug=cli` option and run it in background. This command will pause the test at the point of failure, and print the "socket path" and instructions.

Once the instructions are printed, attach a test session to `playwright-cli` and use it to explore the page.

```bash
# Choose a name (e.g. test1) and attach
playwright-cli session-attach test1 '<socket path>'

# Explore the page and interact if needed
playwright-cli --session=test1 snapshot
playwright-cli --session=test1 click e14
```

Keep the test running in background while you explore and look for a fix. After fixing the test, stop the background test run.

Every action you perform with `playwright-cli` generates corresponding Playwright TypeScript code.
This code appears in the output and can be copied directly into the test. Often times, a locator or an expectation should be updated.

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
# - Use "playwright-cli session-attach <name> '/path/to/socket/file'" to add a session.

# Attach test session
playwright-cli session-attach test1 '/path/to/socket/file'

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
