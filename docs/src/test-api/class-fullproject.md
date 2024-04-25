# class: FullProject
* since: v1.10
* langs: js

Runtime representation of the test project configuration. It is accessible in the tests via [`property: TestInfo.project`] and [`property: WorkerInfo.project`] and is passed to the test reporters. To see the format of the project in the Playwright configuration file please see [TestProject] instead.

## property: FullProject.dependencies
* since: v1.31
- type: <[Array]<[string]>>

See [`property: TestProject.dependencies`].

## property: FullProject.grep
* since: v1.10
- type: <[RegExp]|[Array]<[RegExp]>>

See [`property: TestProject.grep`].

## property: FullProject.grepInvert
* since: v1.10
- type: <[null]|[RegExp]|[Array]<[RegExp]>>

See [`property: TestProject.grepInvert`].

## property: FullProject.metadata
* since: v1.10
- type: <[Metadata]>

See [`property: TestProject.metadata`].

## property: FullProject.name
* since: v1.10
- type: <[string]>

See [`property: TestProject.name`].

## property: FullProject.snapshotDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.snapshotDir`].

## property: FullProject.outputDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.outputDir`].

## property: FullProject.repeatEach
* since: v1.10
- type: <[int]>

See [`property: TestProject.repeatEach`].

## property: FullProject.retries
* since: v1.10
- type: <[int]>

See [`property: TestProject.retries`].

## property: FullProject.teardown
* since: v1.34
- type: ?<[string]>

See [`property: TestProject.teardown`].

## property: FullProject.testDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.testDir`].

## property: FullProject.testIgnore
* since: v1.10
- type: <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

See [`property: TestProject.testIgnore`].

## property: FullProject.testMatch
* since: v1.10
- type: <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

See [`property: TestProject.testMatch`].

## property: FullProject.timeout
* since: v1.10
- type: <[int]>

See [`property: TestProject.timeout`].

## property: FullProject.use
* since: v1.10
- type: <[Fixtures]>

See [`property: TestProject.use`].
