# class: ProjectInWorker
* since: v1.10
* langs: js

Runtime representation of the test project configuration that can be accessed
in the tests via [`property: TestInfo.project`] and [`property: WorkerInfo.project`].

## property: ProjectInWorker.dependencies
* since: v1.31
- type: <[Array]<[string]>>

See [`property: TestProject.dependencies`].

## property: ProjectInWorker.grep
* since: v1.10
- type: <[RegExp]|[Array]<[RegExp]>>

See [`property: TestProject.grep`].

## property: ProjectInWorker.grepInvert
* since: v1.10
- type: <[null]|[RegExp]|[Array]<[RegExp]>>

See [`property: TestProject.grepInvert`].

## property: ProjectInWorker.metadata
* since: v1.10
- type: <[Metadata]>

See [`property: TestProject.metadata`].

## property: ProjectInWorker.name
* since: v1.10
- type: <[string]>

See [`property: TestProject.name`].

## property: ProjectInWorker.snapshotDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.snapshotDir`].

## property: ProjectInWorker.outputDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.outputDir`].

## property: ProjectInWorker.repeatEach
* since: v1.10
- type: <[int]>

See [`property: TestProject.repeatEach`].

## property: ProjectInWorker.retries
* since: v1.10
- type: <[int]>

See [`property: TestProject.retries`].

## property: ProjectInWorker.teardown
* since: v1.34
- type: ?<[string]>

See [`property: TestProject.teardown`].

## property: ProjectInWorker.testDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.testDir`].

## property: ProjectInWorker.testIgnore
* since: v1.10
- type: <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

See [`property: TestProject.testIgnore`].

## property: ProjectInWorker.testMatch
* since: v1.10
- type: <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

See [`property: TestProject.testMatch`].

## property: ProjectInWorker.timeout
* since: v1.10
- type: <[int]>

See [`property: TestProject.timeout`].

## property: ProjectInWorker.use
* since: v1.10
- type: <[Fixtures]>

See [`property: TestProject.use`].
