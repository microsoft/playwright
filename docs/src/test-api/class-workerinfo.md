# class: WorkerInfo
* langs: js

`WorkerInfo` contains information about the worker that is running tests. It is available to [`method: Test.beforeAll`] and [`method: Test.afterAll`] hooks and worker-scoped fixtures.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.beforeAll(async ({ browserName }, workerInfo) => {
  console.log(`Running ${browserName} in worker #${workerInfo.workerIndex}`);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.beforeAll(async ({ browserName }, workerInfo) => {
  console.log(`Running ${browserName} in worker #${workerInfo.workerIndex}`);
});
```

## property: WorkerInfo.config
- type: <[TestConfig]>

Processed configuration from the [configuration file](../test-configuration.md).


## property: WorkerInfo.parallelIndex
- type: <[int]>

The index of the worker between `0` and `workers - 1`. It is guaranteed that workers running at the same time have a different `parallelIndex`. When a worker is restarted, for example after a failure, the new worker process has the same `parallelIndex`.

Also available as `process.env.TEST_PARALLEL_INDEX`. Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.


## property: WorkerInfo.project
- type: <[TestProject]>

Processed project configuration from the [configuration file](../test-configuration.md).


## property: WorkerInfo.workerIndex
- type: <[int]>

The unique index of the worker process that is running the test. When a worker is restarted, for example after a failure, the new worker process gets a new unique `workerIndex`.

Also available as `process.env.TEST_WORKER_INDEX`. Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.
