# Endform Lambda Playwright Fast Start Plan

## Context

Endform runs Playwright tests remotely on AWS Lambda. Each invocation downloads only the exact test file and exact dependencies required for that run. There is no large test tree for Playwright to discover.

Because Lambda execution is per-invocation, a long-lived daemon across invocations is not the primary design target. The goal is to start the required Node Playwright host and worker pair as early as possible within each invocation, overlapping their startup with Endform dependency download, proxy setup, and scratch preparation.

## Key Implication

Skipping broad Playwright discovery is likely not the first optimization to implement.

Playwright discovery scans `project.testDir`, skips `node_modules`, and filters by extension, `testMatch`, and `testIgnore`. If the scratch filesystem contains only the selected test universe, discovery is bounded by a tiny directory tree.

The larger initial costs are likely:

- Node host startup and Playwright import graph.
- Worker process startup and worker import graph.
- Config load.
- Runner-side test file load.
- Worker-side test file load.
- Browser startup.
- Reporter finalization.

## Target Per-Invocation Architecture

1. Rust Lambda handler receives invocation.
2. Rust immediately starts `endform-playwright-host`.
3. Node host imports Playwright runner, worker host, config, reporter, and IPC internals.
4. Node host immediately pre-forks one Playwright worker.
5. Worker reaches `ready`, but does not receive `__init__` yet.
6. Rust downloads the exact test file and dependencies, prepares scratch, starts proxy, and writes/configures the Playwright config shim.
7. Rust sends run parameters to the Node host:
   - scratch root
   - config path
   - selected project
   - selected test file/test identity
   - env overrides
   - reporter transport/artifact settings
8. Node host loads config and runs mostly normal Playwright flow against the tiny scratch filesystem.
9. Dispatcher consumes the already-preforked worker instead of forking late.
10. Worker runs normal Playwright fixture/test/browser code.
11. Node host owns native reporters and streams completion data back to Rust.

## Why Reporter Machinery Should Stay In The Host

Native reporters should not run in the worker process.

Playwright's current architecture assumes workers emit primitive IPC events and the runner reconstructs reporter-facing objects:

- `Suite`
- `TestCase`
- `TestResult`
- `TestStep`
- attachments
- stdout/stderr attribution
- retries and final status

Keeping reporters in the host preserves:

- `onConfigure`
- `onBegin(rootSuite)`
- `onTestBegin`
- `onStepBegin` / `onStepEnd`
- `onTestEnd`
- `onError`
- `onEnd`
- `onExit`

Running reporters in workers risks wrong object identity, duplicated output, artifact races, and incorrect stdout/stderr attribution.

## Phase 1: Eager Boot With Minimal Playwright Changes

Implement per-invocation startup overlap while preserving normal Playwright loading, dispatching, execution, and reporting.

### Required Changes

1. Add a custom `endform-playwright-host` entrypoint outside the normal Playwright CLI.
2. Split `ProcessHost.startRunner()` into two phases:
   - fork child and wait for `ready`
   - later send `__init__`
3. Add delayed initialization support to `WorkerHost`.
4. Allow `Dispatcher` to consume an already-preforked worker slot.

### Expected Benefits

- Worker Node startup overlaps with Endform dependency download.
- Worker module import graph overlaps with Endform setup.
- Host Node startup and Playwright imports overlap with Endform setup.
- Native Playwright reporting remains intact.
- Test execution remains close to upstream Playwright.

### Expected Fork Surface

Rough estimate: 300-700 LoC total, depending on how isolated the host entrypoint is.

The most important Playwright-internal patch is the fork/init split in `ProcessHost` and delayed-init worker support.

### Implemented Internal Shape

The first implementation exposes this internal flow:

```ts
const worker = new WorkerHost(0);
await worker.prefork();

// Later, after scratch/config/test files are ready:
await testRunner.runTests(reporter, {
  locations: [selectedTestFile],
  projects: [selectedProjectName],
  preforkedWorkers: [worker],
});
```

The dispatcher initializes the preforked worker with the real test group, serialized config, output directory, pause flags, and per-run env before sending `runTestGroup`.

## Phase 2: Measure Before Skipping Discovery

After Phase 1, instrument timings for:

- Node host startup/imports.
- Worker fork-to-ready.
- Config load.
- Tiny-tree file collection.
- Runner-side test file load.
- Worker init.
- Worker-side test file load.
- Browser launch/context/page setup.
- Reporter `onEnd`/artifact finalization.

If tiny-tree collection is negligible, do not patch discovery. Spend effort on worker-side test resolution, browser prewarm, or reporter finalization instead.

## Phase 3: Avoid Double Test File Load

Normal Playwright loads the selected file twice:

1. Loader/runner loads it to build suite, test ids, groups, and reporter-facing objects.
2. Worker loads it again to execute.

Since Endform already downloads only the exact selected test universe, removing this duplicate load may matter more than skipping discovery.

### Safer Option: Host-Loaded Known File

Keep runner-side file loading and suite construction, but provide a fast host command that runs against the tiny scratch tree and selected project/test params.

Benefits:

- Minimal semantic risk.
- Native reporters remain unchanged.
- Existing `Dispatcher` and `WorkerMain.runTestGroup()` remain mostly unchanged.

Cost:

- Worker still loads the file again.

### Faster Option: Worker-Resolved Known Test

Add a worker IPC method such as `prepareKnownTest`.

Flow:

1. Host initializes preforked worker with config/project/env.
2. Host sends `{ file, project, titlePath or test selector, repeatEachIndex }`.
3. Worker loads the selected file.
4. Worker binds the file suite to the project.
5. Worker builds fixture pools.
6. Worker finds the selected test.
7. Worker returns serialized suite/test metadata to the host.
8. Host reconstructs reporter-facing `Suite`/`TestCase` objects.
9. Host sends normal `runTestGroup` to the same worker.
10. Worker should reuse its already-loaded file suite via `testLoader` cache.

Benefits:

- Moves test loading to the worker.
- Can avoid the runner-side test file import.
- Keeps native reporters in host.
- Keeps actual test execution close to native worker code.

Costs and risks:

- Larger Playwright fork.
- Host must synthesize a correct reporter-facing suite from worker metadata.
- Duplicate titles need strict handling.
- Worker reuse must remain guarded by project/repeat/worker fixture compatibility.

## Phase 4: Browser Prewarm

If measurement shows browser startup dominates, add optional browser prewarm.

Potential levels:

- Start browser server while dependencies download, then connect from Playwright.
- Keep browser process alive for the duration of the invocation.
- Create a fresh browser context per test to preserve isolation.
- Only consider page/context reuse for explicitly safe tests.

Fresh context reuse is the likely acceptable semantic boundary. Page reuse is a much larger compatibility tradeoff.

## Phase 5: Reporter Finalization Optimization

If blob reporter or artifact finalization is material on the critical path:

- Use a lightweight Endform reporter for pass/fail and completion data.
- Enable blob only when requested.
- Defer blob/archive/upload work out of the critical completion path.
- Use host-side reporter events as the source of completion data.

Do not move blob/native reporter finalization into the worker.

## Recommended Implementation Order

1. Build `endform-playwright-host` with normal Playwright internals.
2. Add per-invocation host startup from Rust before dependency download completes.
3. Split `ProcessHost` fork and init.
4. Add preforked delayed-init worker support.
5. Route normal Playwright run through the preforked worker against the tiny scratch tree.
6. Add timing instrumentation.
7. Decide whether discovery is worth patching. It likely is not if the scratch tree is tiny.
8. Prototype `prepareKnownTest` to avoid double test-file load.
9. Add browser prewarm if measurements justify it.
10. Optimize reporter finalization only if it appears in the critical path.

## Maintained Fork Strategy

Keep the fork surface focused on stable seams:

- process host fork/init split
- worker host delayed init
- dispatcher preforked-worker consumption
- optional worker `prepareKnownTest` IPC

Avoid rewriting:

- fixture execution
- reporter lifecycle
- test result construction unless strictly necessary
- browser fixtures unless browser prewarm measurements justify it

This should make the fork easier to carry across Playwright versions while still attacking the real Lambda cold-start bottleneck.
