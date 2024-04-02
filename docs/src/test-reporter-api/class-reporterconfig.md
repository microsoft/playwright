# class: ReporterConfig
* since: v1.10
* langs: js

Resolved configuration passed to [`method: Reporter.onBegin`].

## property: ReporterConfig.configFile
* since: v1.20
- type: ?<[string]>

Path to the configuration file (if any) used to run the tests.

## property: ReporterConfig.forbidOnly
* since: v1.10
- type: <[boolean]>

See [`property: TestConfig.forbidOnly`].

## property: ReporterConfig.fullyParallel
* since: v1.20
- type: <[boolean]>

See [`property: TestConfig.fullyParallel`].

## property: ReporterConfig.globalSetup
* since: v1.10
- type: <[null]|[string]>

See [`property: TestConfig.globalSetup`].

## property: ReporterConfig.globalTeardown
* since: v1.10
- type: <[null]|[string]>

See [`property: TestConfig.globalTeardown`].

## property: ReporterConfig.globalTimeout
* since: v1.10
- type: <[int]>

See [`property: TestConfig.globalTimeout`].

## property: ReporterConfig.grep
* since: v1.10
- type: <[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grep`].

## property: ReporterConfig.grepInvert
* since: v1.10
- type: <[null]|[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grepInvert`].

## property: ReporterConfig.maxFailures
* since: v1.10
- type: <[int]>

See [`property: TestConfig.maxFailures`].

## property: ReporterConfig.metadata
* since: v1.10
- type: <[Metadata]>

See [`property: TestConfig.metadata`].

## property: ReporterConfig.preserveOutput
* since: v1.10
- type: <[PreserveOutput]<"always"|"never"|"failures-only">>

See [`property: TestConfig.preserveOutput`].

## property: ReporterConfig.projects
* since: v1.10
- type: <[Array]<[ReporterProject]>>

List of resolved projects.

## property: ReporterConfig.quiet
* since: v1.10
- type: <[boolean]>

See [`property: TestConfig.quiet`].

## property: ReporterConfig.reporter
* since: v1.10
- type: <[string]|[Array]<[Object]>|[BuiltInReporter]<"list"|"dot"|"line"|"github"|"json"|"junit"|"null"|"html">>
  - `0` <[string]> Reporter name or module or file path
  - `1` <[Object]> An object with reporter options if any

See [`property: TestConfig.reporter`].

## property: ReporterConfig.reportSlowTests
* since: v1.10
- type: <[null]|[Object]>
  - `max` <[int]> The maximum number of slow test files to report. Defaults to `5`.
  - `threshold` <[float]> Test duration in milliseconds that is considered slow. Defaults to 15 seconds.

See [`property: TestConfig.reportSlowTests`].

## property: ReporterConfig.rootDir
* since: v1.20
- type: <[string]>

## property: ReporterConfig.shard
* since: v1.10
- type: <[null]|[Object]>
  - `total` <[int]> The total number of shards.
  - `current` <[int]> The index of the shard to execute, one-based.

See [`property: TestConfig.shard`].

## property: ReporterConfig.updateSnapshots
* since: v1.10
- type: <[UpdateSnapshots]<"all"|"none"|"missing">>

See [`property: TestConfig.updateSnapshots`].

## property: ReporterConfig.version
* since: v1.20
- type: <[string]>

Playwright version.

## property: ReporterConfig.webServer
* since: v1.10
- type: <[null]|[Object]>

See [`property: TestConfig.webServer`].

## property: ReporterConfig.workers
* since: v1.10
- type: <[int]>

See [`property: TestConfig.workers`].
