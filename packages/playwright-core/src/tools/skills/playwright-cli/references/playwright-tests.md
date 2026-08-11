# Running Playwright Tests

To run Playwright tests, use the project's test runner (or a package manager script). For JS/TS, set `PLAYWRIGHT_HTML_OPEN=never` to avoid opening the interactive html report.

```bash
# JS/TS
PLAYWRIGHT_HTML_OPEN=never npx playwright test
PLAYWRIGHT_HTML_OPEN=never npm run special-test-command

# Python
pytest
```

# Debugging Playwright Tests

To debug a failing Playwright test, run it with the CLI debug option for your runner. This pauses the test at the start and prints the debugging instructions.

**IMPORTANT**: run the command in the background and check the output until "Debugging Instructions" is printed. Make sure to stop the command after you have finished.

Once instructions containing a session name are printed, use `playwright-cli` to attach the session and explore the page.

```bash
# JS/TS
PLAYWRIGHT_HTML_OPEN=never npx playwright test --debug=cli
# ...
# ... debugging instructions for "tw-abcdef" session ...
# ...
playwright-cli attach tw-abcdef

# Python
pytest --playwright-debug=cli -s
playwright-cli attach tw-abcdef
```

Keep the test running in the background while you explore and look for a fix.
The test is paused at the start, so you should step over or pause at a particular location
where the problem is most likely to be.

Every action you perform with `playwright-cli` generates corresponding Playwright code.
This code appears in the output and can be copied directly into the test. Most of the time, a specific locator or an expectation should be updated, but it could also be a bug in the app. Use your judgement.

After fixing the test, stop the background test run. Rerun to check that test passes.
