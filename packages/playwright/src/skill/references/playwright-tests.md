# Running Playwright Tests

To run Playwright tests, use the `npx playwright test` command, or a package manager script. To avoid opening the interactive html report, use `PLAYWRIGHT_HTML_OPEN=never` environment variable.

```bash
# Run all tests
PLAYWRIGHT_HTML_OPEN=never npx playwright test

# Run all tests through a custom npm script
PLAYWRIGHT_HTML_OPEN=never npm run special-test-command
```

# Debugging Playwright Tests

To debug a failing test, run it with Playwright as usual, but set `PWPAUSE=cli` environment variable. This command will pause the test at the point of failure, and print the debugging instructions.

**IMPORTANT**: run the command in the background and check the output until "Debugging Instructions" is printed.

Once instructions are printed, use `playwright-cli` to explore the page. Debugging instructions include a session name that should be used in `playwright-cli` to connect to the page under test. Do not create a new `playwright-cli` session, make sure to connect to the test session instead.

```bash
# Run the test
PLAYWRIGHT_HTML_OPEN=never PWPAUSE=cli npx playwright test
# ...

# Explore the page and interact if needed
playwright-cli --session=test-worker-abcdef snapshot
playwright-cli --session=test-worker-abcdef click e14
```

Keep the test running in the background while you explore and look for a fix. After fixing the test, stop the background test run.

Every action you perform with `playwright-cli` generates corresponding Playwright TypeScript code.
This code appears in the output and can be copied directly into the test. Most of the time, a specific locator or an expectation should be updated, but it could also be a bug in the app. Use your judgement.
