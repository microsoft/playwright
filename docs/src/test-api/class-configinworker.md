# class: ConfigInWorker
* since: v1.10
* langs: js

Resolved configuration available via [`property: TestInfo.config`] and [`property: WorkerInfo.config`].

## property: ConfigInWorker.configFile
* since: v1.20
- type: ?<[string]>

Path to the configuration file (if any) used to run the tests.

## property: ConfigInWorker.forbidOnly
* since: v1.10
- type: <[boolean]>

See [`property: TestConfig.forbidOnly`].

## property: ConfigInWorker.fullyParallel
* since: v1.20
- type: <[boolean]>

See [`property: TestConfig.fullyParallel`].

## property: ConfigInWorker.globalSetup
* since: v1.10
- type: <[null]|[string]>

See [`property: TestConfig.globalSetup`].

## property: ConfigInWorker.globalTeardown
* since: v1.10
- type: <[null]|[string]>

See [`property: TestConfig.globalTeardown`].

## property: ConfigInWorker.globalTimeout
* since: v1.10
- type: <[int]>

See [`property: TestConfig.globalTimeout`].

## property: ConfigInWorker.grep
* since: v1.10
- type: <[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grep`].

## property: ConfigInWorker.grepInvert
* since: v1.10
- type: <[null]|[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grepInvert`].

## property: ConfigInWorker.maxFailures
* since: v1.10
- type: <[int]>

See [`property: TestConfig.maxFailures`].

## property: ConfigInWorker.metadata
* since: v1.10
- type: <[Metadata]>

See [`property: TestConfig.metadata`].

## property: ConfigInWorker.preserveOutput
* since: v1.10
- type: <[PreserveOutput]<"always"|"never"|"failures-only">>

See [`property: TestConfig.preserveOutput`].

## property: ConfigInWorker.projects
* since: v1.10
- type: <[Array]<[ProjectInWorker]>>

List of resolved projects.

## property: ConfigInWorker.quiet
* since: v1.10
- type: <[boolean]>

See [`property: TestConfig.quiet`].

## property: ConfigInWorker.reporter
* since: v1.10
- type: <[string]|[Array]<[Object]>|[BuiltInReporter]<"list"|"dot"|"line"|"github"|"json"|"junit"|"null"|"html">>
  - `0` <[string]> Reporter name or module or file path
  - `1` <[Object]> An object with reporter options if any

See [`property: TestConfig.reporter`].

## property: ConfigInWorker.reportSlowTests
* since: v1.10
- type: <[null]|[Object]>
  - `max` <[int]> The maximum number of slow test files to report. Defaults to `5`.
  - `threshold` <[float]> Test duration in milliseconds that is considered slow. Defaults to 15 seconds.

See [`property: TestConfig.reportSlowTests`].

## property: ConfigInWorker.rootDir
* since: v1.20
- type: <[string]>

## property: ConfigInWorker.shard
* since: v1.10
- type: <[null]|[Object]>
  - `total` <[int]> The total number of shards.
  - `current` <[int]> The index of the shard to execute, one-based.

See [`property: TestConfig.shard`].

## property: ConfigInWorker.updateSnapshots
* since: v1.10
- type: <[UpdateSnapshots]<"all"|"none"|"missing">>

See [`property: TestConfig.updateSnapshots`].

## property: ConfigInWorker.version
* since: v1.20
- type: <[string]>

Playwright version.

## property: ConfigInWorker.webServer
* since: v1.10
- type: <[null]|[Object]>

See [`property: TestConfig.webServer`].

## property: ConfigInWorker.workers
* since: v1.10
- type: <[int]>

See [`property: TestConfig.workers`].
