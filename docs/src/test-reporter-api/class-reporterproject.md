# class: ReporterProject
* since: v1.10
* langs: js

Runtime representation of the test project configuration that is passed
to [Reporter]. It exposes some of the resolved fields declared in
[TestProject]. You can get [ReporterProject] instance from [`property: ReporterConfig.projects`]
or [`method: Suite.project`].

## property: ReporterProject.dependencies
* since: v1.31
- type: <[Array]<[string]>>

See [`property: TestProject.dependencies`].

## property: ReporterProject.grep
* since: v1.10
- type: <[RegExp]|[Array]<[RegExp]>>

See [`property: TestProject.grep`].

## property: ReporterProject.grepInvert
* since: v1.10
- type: <[null]|[RegExp]|[Array]<[RegExp]>>

See [`property: TestProject.grepInvert`].

## property: ReporterProject.metadata
* since: v1.10
- type: <[Metadata]>

See [`property: TestProject.metadata`].

## property: ReporterProject.name
* since: v1.10
- type: <[string]>

See [`property: TestProject.name`].

## property: ReporterProject.snapshotDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.snapshotDir`].

## property: ReporterProject.outputDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.outputDir`].

## property: ReporterProject.repeatEach
* since: v1.10
- type: <[int]>

See [`property: TestProject.repeatEach`].

## property: ReporterProject.retries
* since: v1.10
- type: <[int]>

See [`property: TestProject.retries`].

## property: ReporterProject.teardown
* since: v1.34
- type: ?<[string]>

See [`property: TestProject.teardown`].

## property: ReporterProject.testDir
* since: v1.10
- type: <[string]>

See [`property: TestProject.testDir`].

## property: ReporterProject.testIgnore
* since: v1.10
- type: <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

See [`property: TestProject.testIgnore`].

## property: ReporterProject.testMatch
* since: v1.10
- type: <[string]|[RegExp]|[Array]<[string]|[RegExp]>>

See [`property: TestProject.testMatch`].

## property: ReporterProject.timeout
* since: v1.10
- type: <[int]>

See [`property: TestProject.timeout`].

## property: ReporterProject.use
* since: v1.10
- type: <[Fixtures]>

See [`property: TestProject.use`].
