---
id: test-parallel
title: "Parallelism and sharding"
---

Playwright Test runs tests in parallel by default, using multiple worker processes.

<!-- TOC -->

## Workers

Each worker process creates a new environment to run tests. By default, Playwright Test reuses the worker as much as it can to make testing faster.

Should any test fail, Playwright will discard entire worker process along with the browsers used and will start a new one. That way failing tests can't affect healthy ones.

You can control the maximum number of parallel worker processes via [command line](./test-cli.md) or in the [configuration file](./test-configuration.md).

- Run in parallel by default
  ```bash
  npx playwright test
  ```

- Disable parallelization
  ```bash
  npx playwright test --workers 1
  ```

- Control the number of workers
  ```bash
  npx playwright test --workers 4
  ```

- In the configuration file
  ```js js-flavor=js
  // playwright.config.js
  // @ts-check

  /** @type {import('@playwright/test').PlaywrightTestConfig} */
  const config = {
    // Limit the number of workers on CI, use default locally
    workers: process.env.CI ? 2 : undefined,
  };

  module.exports = config;
  ```

  ```js js-flavor=ts
  // playwright.config.ts
  import { PlaywrightTestConfig } from '@playwright/test';

  const config: PlaywrightTestConfig = {
    // Limit the number of workers on CI, use default locally
    workers: process.env.CI ? 2 : undefined,
  };
  export default config;
  ```

Each worker process is assigned a unique sequential index that is accessible through the [`workerInfo`](./test-advanced.md#workerinfo) object. Since each worker is a process, there also is a process-wide environment variable `process.env.TEST_WORKER_INDEX` that has the same value.

## Shards

Playwright Test can shard a test suite, so that it can be executed on multiple machines. For that,  pass `--shard=x/y` to the command line. For example, to split the suite into three shards, each running one third of the tests:

```bash
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

That way your test suite completes 3 times faster.
