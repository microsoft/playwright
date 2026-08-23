/**
 * 09-test-runner-and-config.js
 *
 * Demonstrates the structure of @playwright/test runner configuration, spec file discovery,
 * project hierarchy, and test list collection.
 *
 * Real source code references studied:
 * - Runner Core Tasks & Lifecycle:
 *   - `packages/playwright/src/runner/tasks.ts` -> `TaskRunner`, `runTasks()`, `TestRun`
 *     Manages task pipeline execution (`createGlobalSetupTasks`, `createRunTestsTasks`).
 * - Spec Discovery & Project Construction:
 *   - `packages/playwright/src/runner/loadUtils.ts` -> `collectProjectsAndTestFiles()`, `loadFileSuites()`
 *     Uses glob patterns (`testMatch`, `testIgnore`) on `FullProjectInternal` to discover test files.
 *     Loads test files using `InProcessLoaderHost` / `OutOfProcessLoaderHost` (`runner/loaderHost.ts`).
 * - Suite Tree & Test Grouping:
 *   - `packages/playwright/src/runner/testGroups.ts` -> `createTestGroups()`
 *     Groups tests by project and worker hash (`TestGroup`), assigning shards and workers.
 * - Dispatcher & Execution:
 *   - `packages/playwright/src/runner/dispatcher.ts` -> `Dispatcher`
 *     Dispatches `TestGroup` payloads over IPC to worker processes (`WorkerHost` in `runner/workerHost.ts`).
 */

// Example configuration showing Playwright Test runner configuration options
const config = {
  testDir: './tests',
  timeout: 30000, // 30 second timeout per test
  retries: 2,     // retry failing tests twice
  workers: 4,     // max 4 parallel worker processes
  reporter: [
    ['list'],
    ['json', { outputFile: 'results.json' }],
    ['html', { open: 'never' }]
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'Chromium Desktop',
      use: { browserName: 'chromium' }
    },
    {
      name: 'Firefox Desktop',
      use: { browserName: 'firefox' }
    }
  ]
};

console.log('Playwright Test runner configuration loaded successfully.');
console.log('Spec discovery uses collectFilesForProject() in loadUtils.ts,');
console.log('spec loading runs via loadFileSuites(),');
console.log('and test groups are dispatched to workers by Dispatcher in dispatcher.ts.');
