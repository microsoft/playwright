---
id: test-parallel
title: "Parallelism and sharding"
---

Playwright Test runs tests in parallel by default, using multiple worker processes.

<!-- TOC -->

<br/>

## Workers

Each worker process creates a new environment to run tests. Different projects always run in different workers. By default, runner reuses the worker as much as it can to make testing faster, but it will create a new worker when retrying tests, after any test failure, to initialize a new environment, or just to speed up test execution if the worker limit is not reached.

The maximum number of worker processes is controlled via [command line](#command-line) or [configuration object](#configuration-object).

Each worker process is assigned a unique sequential index that is accessible through [`workerInfo`](#workerinfo) object.

## Shards

Playwright Test can shard a test suite, so that it can be executed on multiple machines. For that,  pass `--shard=x/y` to the command line. For example, to split the suite into three shards, each running one third of the tests:

```sh
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```
