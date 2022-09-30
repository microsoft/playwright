---
id: running-tests
title: "Running Tests"
---

Playwright tests can be run in a variety of ways. We recommend hooking it up to your favorite test runner, e.g. [JUnit](./test-runners.md) since it gives you the ability to run tests in parallel, run single test, etc.

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer you can run your tests in headed mode by using the `launch(new BrowserType.LaunchOptions().setHeadless(false))` option.

See here how to use it with [JUnit](./test-runners.md).

## What's Next

- [Debugging tests](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)