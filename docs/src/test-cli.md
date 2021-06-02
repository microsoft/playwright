---
id: test-cli
title: "Advanced: command line"
---

```bash
# Ask for help!
npx playwright test --help
```

Arguments passed to `npx playwright test` are treated as a filter for test files. For example, `npx playwright test my-spec` will only run tests from files with `my-spec` in the name.

All the options are available in the [configuration file](./test-advanced.md). However, selected options can be passed to a command line and take a priority over the configuration file.

- `--headed`: Run tests in headed browsers. Useful for debugging.

- `--browser`: Run test in a specific browser. Available options are  `"chromium"`, `"firefox"`, `"webkit"` or `"all"` to run tests in all three browsers at the same time.

- `-c <file>` or `--config <file>`: Configuration file. If not passed, defaults to `playwright.config.ts` or `playwright.config.js` in the current directory.

- `-c <dir>` or `--config <dir>`: Directory with the tests to run without configuration file.

- `--forbid-only`: Whether to disallow `test.only`. Useful on CI.

- `-g <grep>` or `--grep <grep>`: Only run tests matching this regular expression. For example, this will run `'should add to cart'` when passed `-g="add to cart"`.

- `--global-timeout <number>`: Total timeout for the whole test run in milliseconds. By default, there is no global timeout.

- `--list`: List all the tests, but do not run them.

- `--max-failures <N>` or `-x`: Stop after the first `N` test failures. Passing `-x` stops after the first failure.

- `--output <dir>`: Directory for artifacts produced by tests, defaults to `test-results`.

- `--project <name>`: Only run tests from one of the specified [projects](./test-advanced.md#projects). Defaults to running all projects defined in the configuration file.

- `--quiet`: Whether to suppress stdout and stderr from the tests.

- `--repeat-each <N>`: Run each test `N` times, defaults to one.

- `--reporter <reporter>`: Choose a reporter: minimalist `dot`, concise `line` or detailed `list`. See [reporters](./test-reporters.md) for more information.

- `--retries <number>`: The maximum number of [retries](./test-retries.md) for flaky tests, defaults to zero (no retries).

- `--shard <shard>`: [Shard](./test-parallel.md#shards) tests and execute only selected shard, specified in the form `current/all`, 1-based, for example `3/5`.

- `--timeout <number>`: Maximum timeout in milliseconds for each test, defaults to 30 seconds.

- `--update-snapshots` or `-u`: Whether to update [snapshots](./test-snapshots.md) with actual results instead of comparing them. Use this when snapshot expectations have changed.

- `--workers <number>` or `-j <number>`: The maximum number of concurrent worker processes that run in [parallel](./test-parallel.md).
