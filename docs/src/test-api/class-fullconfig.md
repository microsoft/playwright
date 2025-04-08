# class: FullConfig
* since: v1.10
* langs: js

Resolved configuration which is accessible via [`property: TestInfo.config`] and is passed to the test reporters. To see the format of Playwright configuration file, please see [TestConfig] instead.

## property: FullConfig.configFile
* since: v1.20
- type: ?<[string]>

Path to the configuration file used to run the tests. The value is an empty string if no config file was used.

## property: FullConfig.forbidOnly
* since: v1.10
- type: <[boolean]>

See [`property: TestConfig.forbidOnly`].

## property: FullConfig.fullyParallel
* since: v1.20
- type: <[boolean]>

See [`property: TestConfig.fullyParallel`].

## property: FullConfig.globalSetup
* since: v1.10
- type: <[null]|[string]>

See [`property: TestConfig.globalSetup`].

## property: FullConfig.globalTeardown
* since: v1.10
- type: <[null]|[string]>

See [`property: TestConfig.globalTeardown`].

## property: FullConfig.globalTimeout
* since: v1.10
- type: <[int]>

See [`property: TestConfig.globalTimeout`].

## property: FullConfig.grep
* since: v1.10
- type: <[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grep`].

## property: FullConfig.grepInvert
* since: v1.10
- type: <[null]|[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grepInvert`].

## property: FullConfig.maxFailures
* since: v1.10
- type: <[int]>

See [`property: TestConfig.maxFailures`].

## property: FullConfig.metadata
* since: v1.10
- type: <[Metadata]>

See [`property: TestConfig.metadata`].

## property: FullConfig.preserveOutput
* since: v1.10
- type: <[PreserveOutput]<"always"|"never"|"failures-only">>

See [`property: TestConfig.preserveOutput`].

## property: FullConfig.projects
* since: v1.10
- type: <[Array]<[FullProject]>>

List of resolved projects.

## property: FullConfig.quiet
* since: v1.10
- type: <[boolean]>

See [`property: TestConfig.quiet`].

## property: FullConfig.reporter
* since: v1.10
- type: <[string]|[Array]<[Object]>|[BuiltInReporter]<"list"|"dot"|"line"|"github"|"json"|"junit"|"null"|"html">>
  - `0` <[string]> Reporter name or module or file path
  - `1` <[Object]> An object with reporter options if any

See [`property: TestConfig.reporter`].

## property: FullConfig.reportSlowTests
* since: v1.10
- type: <[null]|[Object]>
  - `max` <[int]> The maximum number of slow test files to report.
  - `threshold` <[float]> Test file duration in milliseconds that is considered slow.

See [`property: TestConfig.reportSlowTests`].

## property: FullConfig.rootDir
* since: v1.20
- type: <[string]>

Base directory for all relative paths used in the reporters.

## property: FullConfig.shard
* since: v1.10
- type: <[null]|[Object]>
  - `total` <[int]> The total number of shards.
  - `current` <[int]> The index of the shard to execute, one-based.

See [`property: TestConfig.shard`].

## property: FullConfig.updateSnapshots
* since: v1.10
- type: <[UpdateSnapshots]<"all"|"changed"|"missing"|"none">>

See [`property: TestConfig.updateSnapshots`].

## property: FullConfig.updateSourceMethod
* since: v1.50
- type: <[UpdateSourceMethod]<"overwrite"|"3way"|"patch">>

See [`property: TestConfig.updateSourceMethod`].

## property: FullConfig.version
* since: v1.20
- type: <[string]>

Playwright version.

## property: FullConfig.webServer
* since: v1.10
- type: <[null]|[Object]>

See [`property: TestConfig.webServer`].

## property: FullConfig.workers
* since: v1.10
- type: <[int]>

See [`property: TestConfig.workers`].
