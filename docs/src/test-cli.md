---
id: test-cli
title: "Command Line"
---

```sh
# Ask for help!
npx playwright test --help
```

Arguments passed to `npx playwright test` are treated as a filter for test files. For example, `npx playwright test my-spec` will only run tests from files with `my-spec` in the name.

All the options are available in the [configuration file](#writing-a-configuration-file). However, selected options can be passed to a command line and take a priority over the configuration file:
- `--config <file>` or `-c <file>`: Configuration file. Defaults to `pwtest.config.ts` or `pwtest.config.js` in the current directory.
- `--forbid-only`: Whether to disallow `test.only` exclusive tests. Useful on CI. Overrides `config.forbidOnly` option from the configuration file.
- `--grep <grep>` or `-g <grep>`: Only run tests matching this regular expression, for example `/my.*test/i` or `my-test`. Overrides `config.grep` option from the configuration file.
- `--global-timeout <number>`: Total timeout in milliseconds for the whole test run. By default, there is no global timeout. Overrides `config.globalTimeout` option from the configuration file.
- `--help`: Display help.
- `--list`: List all the tests, but do not run them.
- `--max-failures <N>` or `-x`: Stop after the first `N` test failures. Passing `-x` stops after the first failure. Overrides `config.maxFailures` option from the configuration file.
- `--output <dir>`: Directory for artifacts produced by tests, defaults to `test-results`. Overrides `config.outputDir` option from the configuration file.
- `--quiet`: Whether to suppress stdout and stderr from the tests. Overrides `config.quiet` option from the configuration file.
- `--repeat-each <number>`: Specifies how many times to run each test. Defaults to one. Overrides `config.repeatEach` option from the configuration file.
- `--reporter <reporter>`. Specify reporter to use, comma-separated, can be some combination of `dot`, `json`, `junit`, `line`, `list` and `null`. See [reporters](#reporters) for more information.
- `--retries <number>`: The maximum number of retries for each [flaky test](#flaky-tests), defaults to zero (no retries). Overrides `config.retries` option from the configuration file.
- `--shard <shard>`: [Shard](#shards) tests and execute only selected shard, specified in the form `current/all`, 1-based, for example `3/5`. Overrides `config.shard` option from the configuration file.
- `--project <project...>`: Only run tests from one of the specified [projects](#projects). Defaults to running all projects defined in the configuration file.
- `--timeout <number>`: Maximum timeout in milliseconds for each test, defaults to 10 seconds. Overrides `config.timeout` option from the configuration file.
- `--update-snapshots` or `-u`: Whether to update snapshots with actual results instead of comparing them. Use this when snapshot expectations have changed. Overrides `config.updateSnapshots` option from the configuration file.
- `--workers <workers>` or `-j <workers>`: The maximum number of concurrent worker processes.  Overrides `config.workers` option from the configuration file.
