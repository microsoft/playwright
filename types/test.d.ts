/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Browser, BrowserContext, BrowserContextOptions, Page, LaunchOptions, ViewportSize, Geolocation, HTTPCredentials } from './types';
import type { Expect } from './testExpect';

export type { Expect } from './testExpect';

export type ReporterDescription =
  ['dot'] |
  ['line'] |
  ['list'] |
  ['junit'] | ['junit', { outputFile?: string, stripANSIControlSequences?: boolean }] |
  ['json'] | ['json', { outputFile?: string }] |
  ['null'] |
  [string] | [string, any];

export type Shard = { total: number, current: number } | null;
export type ReportSlowTests = { max: number, threshold: number } | null;
export type PreserveOutput = 'always' | 'never' | 'failures-only';
export type UpdateSnapshots = 'all' | 'none' | 'missing';

type FixtureDefine<TestArgs extends KeyValue = {}, WorkerArgs extends KeyValue = {}> = { test: TestType<TestArgs, WorkerArgs>, fixtures: Fixtures<{}, {}, TestArgs, WorkerArgs> };

type ExpectSettings = {
  toMatchSnapshot?: {
    // Pixel match threshold.
    threshold?: number
  }
};

/**
 * Test run configuration.
 */
interface ProjectBase {
  /**
   * Expect matcher settings.
   */
  expect?: ExpectSettings;

  /**
   * Any JSON-serializable metadata that will be put directly to the test report.
   */
  metadata?: any;

  /**
   * The project name, shown in the title of each test.
   */
  name?: string;

  /**
   * Output directory for files created during the test run.
   */
  outputDir?: string;

  /**
   * The number of times to repeat each test, useful for debugging flaky tests.
   */
  repeatEach?: number;

  /**
   * The maximum number of retry attempts given to failed tests.
   */
  retries?: number;

  /**
   * Directory that will be recursively scanned for test files.
   */
  testDir?: string;

  /**
   * Files matching one of these patterns are not executed as test files.
   * Matching is performed against the absolute file path.
   * Strings are treated as glob patterns.
   */
  testIgnore?: string | RegExp | (string | RegExp)[];

  /**
   * Only the files matching one of these patterns are executed as test files.
   * Matching is performed against the absolute file path.
   * Strings are treated as glob patterns.
   */
  testMatch?: string | RegExp | (string | RegExp)[];

  /**
   * Timeout for each test in milliseconds.
   */
  timeout?: number;
}

/**
 * Test run configuration.
 */
export interface Project<TestArgs = {}, WorkerArgs = {}> extends ProjectBase {
  /**
   * Fixtures defined for abstract tests created with `test.declare()` method.
   */
  define?: FixtureDefine | FixtureDefine[];

  /**
   * Fixture overrides for this run. Useful for specifying options.
   */
  use?: Fixtures<{}, {}, TestArgs, WorkerArgs>;
}

export type FullProject<TestArgs = {}, WorkerArgs = {}> = Required<Project<TestArgs, WorkerArgs>>;

/**
 * Testing configuration.
 */
interface ConfigBase {
  /**
   * Whether to exit with an error if any tests are marked as `test.only`. Useful on CI.
   */
  forbidOnly?: boolean;

  /**
   * Path to the global setup file. This file will be required and run before all the tests.
   * It must export a single function.
   */
  globalSetup?: string;

  /**
   * Path to the global teardown file. This file will be required and run after all the tests.
   * It must export a single function.
   */
  globalTeardown?: string;

  /**
   * Maximum time in milliseconds the whole test suite can run.
   */
  globalTimeout?: number;

  /**
   * Filter to only run tests with a title matching one of the patterns.
   */
  grep?: RegExp | RegExp[];

  /**
   * The maximum number of test failures for this test run. After reaching this number,
   * testing will stop and exit with an error. Setting to zero (default) disables this behavior.
   */
  maxFailures?: number;

  /**
   * Whether to preserve test output in the `outputDir`:
   * - `'always'` - preserve output for all tests;
   * - `'never'` - do not preserve output for any tests;
   * - `'failures-only'` - only preserve output for failed tests.
   */
  preserveOutput?: PreserveOutput;

  /**
   * Whether to suppress stdio output from the tests.
   */
   quiet?: boolean;

  /**
   * Reporter to use. Available options:
   * - `'list'` - default reporter, prints a single line per test;
   * - `'dot'` - minimal reporter that prints a single character per test run, useful on CI;
   * - `'line'` - uses a single line for all successfull runs, useful for large test suites;
   * - `'json'` - outputs a json file with information about the run;
   * - `'junit'` - outputs an xml file with junit-alike information about the run;
   * - `'null'` - no reporter, test run will be silent.
   *
   * It is possible to pass multiple reporters. A common pattern is using one terminal reporter
   * like `'line'` or `'list'`, and one file reporter like `'json'` or `'junit'`.
   */
  reporter?: 'dot' | 'line' | 'list' | 'junit' | 'json' | 'null' | ReporterDescription[];

  /**
   * Whether to report slow tests. When `null`, slow tests are not reported.
   * Otherwise, tests that took more than `threshold` milliseconds are reported as slow,
   * but no more than `max` number of them. Passing zero as `max` reports all slow tests
   * that exceed the threshold.
   */
  reportSlowTests?: ReportSlowTests;

  /**
   * Shard tests and execute only the selected shard.
   * Specify in the one-based form `{ total: 5, current: 2 }`.
   */
  shard?: Shard;

  /**
   * Whether to update expected snapshots with the actual results produced by the test run.
   */
  updateSnapshots?: UpdateSnapshots;

  /**
   * The maximum number of concurrent worker processes to use for parallelizing tests.
   */
  workers?: number;
}

/**
 * Testing configuration.
 */
export interface Config<TestArgs = {}, WorkerArgs = {}> extends ConfigBase, Project<TestArgs, WorkerArgs> {
  /**
   * Projects specify test files that are executed with a specific configuration.
   */
  projects?: Project<TestArgs, WorkerArgs>[];
}

export interface FullConfig {
  forbidOnly: boolean;
  globalSetup: string | null;
  globalTeardown: string | null;
  globalTimeout: number;
  grep: RegExp | RegExp[];
  maxFailures: number;
  preserveOutput: PreserveOutput;
  projects: FullProject[];
  reporter: ReporterDescription[];
  reportSlowTests: ReportSlowTests;
  rootDir: string;
  quiet: boolean;
  shard: Shard;
  updateSnapshots: UpdateSnapshots;
  workers: number;
}

export type TestStatus = 'passed' | 'failed' | 'timedOut' | 'skipped';

/**
 * Information common for all tests run in the same worker process.
 */
export interface WorkerInfo {
  /**
   * Testing configuration.
   */
  config: FullConfig;

  /**
   * Specific project configuration for this worker.
   * Different projects are always run in separate processes.
   */
  project: FullProject;

  /**
   * Unique worker index. Also available as `process.env.TEST_WORKER_INDEX`.
   */
  workerIndex: number;
}

/**
 * Information about a particular test run.
 */
export interface TestInfo extends WorkerInfo {
  /**
   * Test title as passed to `test('my test title', testFunction)`.
   */
  title: string;

  /**
   * Path to the file where test is declared.
   */
  file: string;

  /**
   * Line number in the test file where the test is declared.
   */
  line: number;

  /**
   * Column number in the test file where the test is declared.
   */
  column: number;

  /**
   * The test function as passed to `test('my test title', testFunction)`.
   */
  fn: Function;

  /**
   * Call this method to skip the current test.
   */
  skip(): void;
  skip(condition: boolean): void;
  skip(condition: boolean, description: string): void;

  /**
   * Call this method to mark the current test as "needs to be fixed". The test will not be run.
   */
  fixme(): void;
  fixme(condition: boolean): void;
  fixme(condition: boolean, description: string): void;

  /**
   * Call this method to mark the current test as "expected to fail". The test will be run and must fail.
   */
  fail(): void;
  fail(condition: boolean): void;
  fail(condition: boolean, description: string): void;

  /**
   * Call this method to mark the current test as slow. The default timeout will be trippled.
   */
  slow(): void;
  slow(condition: boolean): void;
  slow(condition: boolean, description: string): void;

  /**
   * Call this method to set a custom timeout for the current test.
   */
  setTimeout(timeout: number): void;

  /**
   * The expected status for the test:
   * - `'passed'` for most tests;
   * - `'failed'` for tests marked with `test.fail()`;
   * - `'skipped'` for tests marked with `test.skip()` or `test.fixme()`.
   */
  expectedStatus: TestStatus;

  /**
   * Timeout in milliseconds for this test.
   */
  timeout: number;

  /**
   * Annotations collected for this test.
   */
  annotations: { type: string, description?: string }[];

  /**
   * When tests are run multiple times, each run gets a unique `repeatEachIndex`.
   */
  repeatEachIndex: number;

  /**
   * When the test is retried after a failure, `retry` indicates the attempt number.
   * Zero for the first (non-retry) run.
   *
   * The maximum number of retries is configurable with `retries` field in the config.
   */
  retry: number;

  /**
   * The number of milliseconds this test took to finish.
   * Only available after the test has finished.
   */
  duration: number;

  /**
   * The result of the run.
   * Only available after the test has finished.
   */
  status?: TestStatus;

  /**
   * The error thrown by the test if any.
   * Only available after the test has finished.
   */
  error?: any;

  /**
   * Output written to `process.stdout` or `console.log` from the test.
   * Only available after the test has finished.
   */
  stdout: (string | Buffer)[];

  /**
   * Output written to `process.stderr` or `console.error` from the test.
   * Only available after the test has finished.
   */
  stderr: (string | Buffer)[];

  /**
   * Suffix used to differentiate snapshots between multiple test configurations.
   * For example, if snapshots depend on the platform, you can set `testInfo.snapshotSuffix = process.platform`,
   * and `expect(value).toMatchSnapshot(snapshotName)` will use different snapshots depending on the platform.
   */
  snapshotSuffix: string;

  /**
   * Absolute path to the output directory for this specific test run.
   * Each test gets its own directory.
   */
  outputDir: string;

  /**
   * Returns a path to a snapshot file.
   */
  snapshotPath: (snapshotName: string) => string;

  /**
   * Returns a path inside the `outputDir` where the test can safely put a temporary file.
   * Guarantees that tests running in parallel will not interfere with each other.
   *
   * ```js
   * const file = testInfo.outputPath('temporary-file.txt');
   * await fs.promises.writeFile(file, 'Put some data to the file', 'utf8');
   * ```
   */
  outputPath: (...pathSegments: string[]) => string;
}

interface SuiteFunction {
  (name: string, inner: () => void): void;
}

interface TestFunction<TestArgs> {
  (name: string, inner: (args: TestArgs, testInfo: TestInfo) => Promise<void> | void): void;
}

/**
 * Call this function to declare a test.
 *
 * ```js
 * test('my test title', async () => {
 *   // Test code goes here.
 * });
 * ```
 */
export interface TestType<TestArgs extends KeyValue, WorkerArgs extends KeyValue> extends TestFunction<TestArgs & WorkerArgs> {
  /**
   * Use `test.only()` instead of `test()` to ignore all other tests and only run this one.
   * Useful for debugging a particular test.
   *
   * ```js
   * test.only('my test title', async () => {
   *   // Only this test will run.
   * });
   * ```
   *
   * All tests marked as `test.only()` will be run, so you can mark multiple of them.
   */
  only: TestFunction<TestArgs & WorkerArgs>;

  /**
   * Declare a block of related tests.
   *
   * ```js
   * test.decribe('my test suite', () => {
   *   test('one test', async () => {
   *     // Test code goes here.
   *   });
   *
   *   test('another test', async () => {
   *     // Test code goes here.
   *   });
   * });
   * ```
   *
   * Any `beforeEach`, `afterEach`, `beforeAll` and `afterAll` hooks declared inside the `test.decribe()` block
   * will only affect the tests from this block.
   */
  describe: SuiteFunction & {
    /**
     * Use `test.describe.only()` instead of `test.describe()` to ignore all other tests and only run this block.
     * Useful for debugging a few tests.
     */
    only: SuiteFunction;
  };

  /**
   * Skip running this test.
   *
   * ```js
   * test('my test title', async () => {
   *   test.skip();
   *   // Test code goes here. It will not be executed.
   * });
   * ```
   */
  skip(): void;

  /**
   * Skip running this test when `condition` is true.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.skip(browserName === 'webkit');
   *   // Test code goes here. It will not be executed in WebKit.
   * });
   * ```
   */
  skip(condition: boolean): void;

  /**
   * Skip running this test when `condition` is true.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.skip(browserName === 'webkit', 'Layout is funky');
   *   // Test code goes here. It will not be executed in WebKit.
   * });
   * ```
   */
  skip(condition: boolean, description: string): void;

  /**
   * Skip running tests in the `describe` block based on some condition.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.skip(() => browserName === 'webkit');
   *
   *   // Declare tests below - they will not be executed in WebKit.
   * });
   * ```
   */
  skip(callback: (args: TestArgs & WorkerArgs) => boolean): void;

  /**
   * Skip running tests in the `describe` block based on some condition.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.skip(() => browserName === 'webkit', 'Layout is funky');
   *
   *   // Declare tests below - they will not be executed in WebKit.
   * });
   * ```
   */
  skip(callback: (args: TestArgs & WorkerArgs) => boolean, description: string): void;

  /**
   * Skip running this test, with intention to fix it later.
   *
   * ```js
   * test('my test title', async () => {
   *   test.fixme();
   *   // Test code goes here. It will not be executed.
   * });
   * ```
   */
  fixme(): void;

  /**
   * Skip running this test when `condition` is true, with intention to fix it later.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.fixme(browserName === 'webkit');
   *   // Test code goes here. It will not be executed in WebKit.
   * });
   * ```
   */
  fixme(condition: boolean): void;

  /**
   * Skip running this test when `condition` is true, with intention to fix it later.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.fixme(browserName === 'webkit', 'Layout is funky');
   *   // Test code goes here. It will not be executed in WebKit.
   * });
   * ```
   */
  fixme(condition: boolean, description: string): void;

  /**
   * Skip running tests in the `describe` block based on some condition, with intention to fix it later.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.fixme(() => browserName === 'webkit');
   *
   *   // Declare tests below - they will not be executed in WebKit.
   * });
   * ```
   */
  fixme(callback: (args: TestArgs & WorkerArgs) => boolean): void;

  /**
   * Skip running tests in the `describe` block based on some condition, with intention to fix it later.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.fixme(() => browserName === 'webkit', 'Layout is funky');
   *
   *   // Declare tests below - they will not be executed in WebKit.
   * });
   * ```
   */
  fixme(callback: (args: TestArgs & WorkerArgs) => boolean, description: string): void;

  /**
   * Mark the test as "expected to fail". It will be run and should fail.
   * When "expected to fail" test acceidentally passes, test runner will exit with an error.
   *
   * ```js
   * test('my test title', async () => {
   *   test.fail();
   *   // Test code goes here.
   * });
   * ```
   */
  fail(): void;

  /**
   * Mark the test as "expected to fail", when `condition` is true. It will be run and should fail.
   * When "expected to fail" test acceidentally passes, test runner will exit with an error.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.fail(browserName === 'webkit');
   *   // Test code goes here. It should fail in WebKit.
   * });
   * ```
   */
  fail(condition: boolean): void;

  /**
   * Mark the test as "expected to fail", when `condition` is true. It will be run and should fail.
   * When "expected to fail" test acceidentally passes, test runner will exit with an error.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.fail(browserName === 'webkit', 'Layout is funky, see issue #1234');
   *   // Test code goes here. It should fail in WebKit.
   * });
   * ```
   */
  fail(condition: boolean, description: string): void;

  /**
   * Mark tests in the `describe` block as "expected to fail" based on some condition.
   * The tests will be run and should fail.
   * When "expected to fail" test acceidentally passes, test runner will exit with an error.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.fail(() => browserName === 'webkit');
   *
   *   // Declare tests below - they should fail in WebKit.
   * });
   * ```
   */
  fail(callback: (args: TestArgs & WorkerArgs) => boolean): void;

  /**
   * Mark tests in the `describe` block as "expected to fail" based on some condition.
   * The tests will be run and should fail.
   * When "expected to fail" test acceidentally passes, test runner will exit with an error.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.fail(() => browserName === 'webkit', 'Layout is funky, see issue #1234');
   *
   *   // Declare tests below - they should fail in WebKit.
   * });
   * ```
   */
  fail(callback: (args: TestArgs & WorkerArgs) => boolean, description: string): void;

  /**
   * Triples the default timeout for this test.
   *
   * ```js
   * test('my test title', async () => {
   *   test.slow();
   *   // Test code goes here.
   * });
   * ```
   */
  slow(): void;

  /**
   * Triples the default timeout for this test, when `condition` is true.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.slow(browserName === 'webkit');
   *   // Test code goes here. It will be given triple timeout in WebKit.
   * });
   * ```
   */
  slow(condition: boolean): void;

  /**
   * Triples the default timeout for this test, when `condition` is true.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test('my test title', async ({ browserName }) => {
   *   test.slow(browserName === 'webkit', 'See issue #1234');
   *   // Test code goes here. It will be given triple timeout in WebKit.
   * });
   * ```
   */
  slow(condition: boolean, description: string): void;

  /**
   * Give all tests in the `describe` block triple timeout, based on some condition.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.slow(() => browserName === 'webkit');
   *
   *   // Declare tests below - they will be given triple timeout in WebKit.
   * });
   * ```
   */
  slow(callback: (args: TestArgs & WorkerArgs) => boolean): void;

  /**
   * Give all tests in the `describe` block triple timeout, based on some condition.
   * Put a reason in `description` to easily remember it later.
   *
   * ```js
   * test.describe('my tests', ({ browserName }) => {
   *   test.slow(() => browserName === 'webkit', 'See issue #1234');
   *
   *   // Declare tests below - they will be given triple timeout in WebKit.
   * });
   * ```
   */
  slow(callback: (args: TestArgs & WorkerArgs) => boolean, description: string): void;

  /**
   * Set a custom timeout for the test.
   *
   * ```js
   * test('my test title', async () => {
   *   // Give this test 20 seconds.
   *   test.setTimeout(20000);
   *   // Test code goes here.
   * });
   * ```
   */
  setTimeout(timeout: number): void;

  /**
   * Declare a hook that will be run before each test.
   * It may use all the available fixtures.
   *
   * ```js
   * test.beforeEach(async ({ fixture }, testInfo) => {
   *   // Do some work here.
   * });
   * ```
   *
   * When called inside a `test.describe()` block, the hook only applies to the tests from the block.
   */
  beforeEach(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;

  /**
   * Declare a hook that will be run after each test.
   * It may use all the available fixtures.
   *
   * ```js
   * test.afterEach(async ({ fixture }, testInfo) => {
   *   // Do some work here.
   * });
   * ```
   *
   * When called inside a `test.describe()` block, the hook only applies to the tests from the block.
   */
  afterEach(inner: (args: TestArgs & WorkerArgs, testInfo: TestInfo) => Promise<any> | any): void;

  /**
   * Declare a hook that will be run once before all tests in the file.
   * It may use all worker-scoped fixtures.
   *
   * ```js
   * test.beforeAll(async ({ workerFixture }, workerInfo) => {
   *   // Do some work here.
   * });
   * ```
   *
   * When called inside a `test.describe()` block, the hook only applies to the tests from the block.
   */
  beforeAll(inner: (args: WorkerArgs, workerInfo: WorkerInfo) => Promise<any> | any): void;

  /**
   * Declare a hook that will be run once after all tests in the file.
   * It may use all worker-scoped fixtures.
   *
   * ```js
   * test.afterAll(async ({ workerFixture }, workerInfo) => {
   *   // Do some work here.
   * });
   * ```
   *
   * When called inside a `test.describe()` block, the hook only applies to the tests from the block.
   */
  afterAll(inner: (args: WorkerArgs, workerInfo: WorkerInfo) => Promise<any> | any): void;

  /**
   * Declare fixtures/options to be used for tests in this file.
   *
   * ```js
   * test.use({ ignoreHTTPSErrors: true });
   *
   * test('my test title', async ({ page }) => {
   *   // Test code goes here.
   * });
   * ```
   *
   * When called inside a `test.describe()` block, fixtures/options only apply to the tests from the block.
   */
  use(fixtures: Fixtures<{}, {}, TestArgs, WorkerArgs>): void;

  /**
   * Use `test.expect(value).toBe(expected)` to assert something in the test.
   * See [expect library](https://jestjs.io/docs/expect) documentation for more details.
   */
  expect: Expect;

  declare<T extends KeyValue = {}, W extends KeyValue = {}>(): TestType<TestArgs & T, WorkerArgs & W>;

  /**
   * Extend the test with fixtures. These fixtures will be invoked for test when needed,
   * can perform setup/teardown and provide a resource to the test.
   *
   * ```ts
   * import { test as base } from '@playwright/test';
   * import rimraf from 'rimraf';
   *
   * const test = base.extend<{ dirCount: number, dirs: string[] }>({
   *   // Define an option that can be configured in tests with `test.use()`.
   *   // Provide a default value.
   *   dirCount: 1,
   *
   *   // Define a fixture that provides some useful functionality to the test.
   *   // In this example, it will create some temporary directories.
   *   dirs: async ({ dirCount }, use, testInfo) => {
   *     // Our fixture uses the "dirCount" option that can be configured by the test.
   *     const dirs = [];
   *     for (let i = 0; i < dirCount; i++) {
   *       // Create an isolated directory.
   *       const dir = testInfo.outputPath('dir-' + i);
   *       await fs.promises.mkdir(dir, { recursive: true });
   *       dirs.push(dir);
   *     }
   *
   *     // Use the list of directories in the test.
   *     await use(dirs);
   *
   *     // Cleanup if needed.
   *     for (const dir of dirs)
   *       await new Promise(done => rimraf(dir, done));
   *   },
   * });
   *
   *
   * // Tests in this file need two temporary directories.
   * test.use({ dirCount: 2 });
   *
   * test('my test title', async ({ dirs }) => {
   *   // Test code goes here.
   *   // It can use "dirs" right away - the fixture has already run and created two temporary directories.
   * });
   * ```
   */
  extend<T, W extends KeyValue = {}>(fixtures: Fixtures<T, W, TestArgs, WorkerArgs>): TestType<TestArgs & T, WorkerArgs & W>;
}

type KeyValue = { [key: string]: any };
export type TestFixture<R, Args extends KeyValue> = (args: Args, use: (r: R) => Promise<void>, testInfo: TestInfo) => any;
export type WorkerFixture<R, Args extends KeyValue> = (args: Args, use: (r: R) => Promise<void>, workerInfo: WorkerInfo) => any;
type TestFixtureValue<R, Args> = R | TestFixture<R, Args>;
type WorkerFixtureValue<R, Args> = R | WorkerFixture<R, Args>;
export type Fixtures<T extends KeyValue = {}, W extends KeyValue = {}, PT extends KeyValue = {}, PW extends KeyValue = {}> = {
  [K in keyof PW]?: WorkerFixtureValue<PW[K], W & PW>;
} & {
  [K in keyof PT]?: TestFixtureValue<PT[K], T & W & PT & PW>;
} & {
  [K in keyof W]?: [WorkerFixtureValue<W[K], W & PW>, { scope: 'worker', auto?: boolean }];
} & {
  [K in keyof T]?: TestFixtureValue<T[K], T & W & PT & PW> | [TestFixtureValue<T[K], T & W & PT & PW>, { scope?: 'test', auto?: boolean }];
};

/**
 * The name of the browser supported by Playwright.
 */
type BrowserName = 'chromium' | 'firefox' | 'webkit';

/**
 * Browser channel name. Used to run tests in different browser flavors,
 * for example Google Chrome Beta, or Microsoft Edge Stable.
 * @see BrowserContextOptions
 */
type BrowserChannel = Exclude<LaunchOptions['channel'], undefined>;

/**
 * Emulates `'prefers-colors-scheme'` media feature,
 * supported values are `'light'`, `'dark'`, `'no-preference'`.
 * @see BrowserContextOptions
 */
type ColorScheme = Exclude<BrowserContextOptions['colorScheme'], undefined>;

/**
 * An object containing additional HTTP headers to be sent with every request. All header values must be strings.
 * @see BrowserContextOptions
 */
type ExtraHTTPHeaders = Exclude<BrowserContextOptions['extraHTTPHeaders'], undefined>;

/**
 * Proxy settings available for all tests, or individually per test.
 * @see BrowserContextOptions
 */
type Proxy = Exclude<BrowserContextOptions['proxy'], undefined>;

/**
 * Storage state for the test.
 * @see BrowserContextOptions
 */
type StorageState = Exclude<BrowserContextOptions['storageState'], undefined>;

/**
 * Options available to configure browser launch.
 *   - Set options in config:
 *   ```js
 *     use: { browserName: 'webkit' }
 *   ```
 *   - Set options in test file:
 *   ```js
 *     test.use({ browserName: 'webkit' })
 *   ```
 *
 * Available as arguments to the test function and all hooks (beforeEach, afterEach, beforeAll, afterAll).
 */
export type PlaywrightWorkerOptions = {
  /**
   * Name of the browser (`chromium`, `firefox`, `webkit`) that runs tests.
   */
  browserName: BrowserName;
  defaultBrowserType: BrowserName;

  /**
   * Whether to run browser in headless mode. Takes priority over `launchOptions`.
   * @see LaunchOptions
   */
  headless: boolean | undefined;

  /**
   * Browser distribution channel. Takes priority over `launchOptions`.
   * @see LaunchOptions
   */
  channel: BrowserChannel | undefined;

  /**
   * Options used to launch the browser. Other options above (e.g. `headless`) take priority.
   * @see LaunchOptions
   */
  launchOptions: LaunchOptions;
};

/**
 * Options available to configure each test.
 *   - Set options in config:
 *   ```js
 *     use: { video: 'on' }
 *   ```
 *   - Set options in test file:
 *   ```js
 *     test.use({ video: 'on' })
 *   ```
 *
 * Available as arguments to the test function and beforeEach/afterEach hooks.
 */
export type PlaywrightTestOptions = {
  /**
   * Whether to capture a screenshot after each test, off by default.
   * - `off`: Do not capture screenshots.
   * - `on`: Capture screenshot after each test.
   * - `only-on-failure`: Capture screenshot after each test failure.
   */
  screenshot: 'off' | 'on' | 'only-on-failure';

  /**
   * Whether to record trace for each test, off by default.
   * - `off`: Do not record trace.
   * - `on`: Record trace for each test.
   * - `retain-on-failure`: Record trace for each test, but remove trace from successful test run.
   * - `retry-with-trace`: Record trace only when retrying a test.
   */
  trace: 'off' | 'on' | 'retain-on-failure' | 'retry-with-trace';

  /**
  * Whether to record video for each test, off by default.
  * - `off`: Do not record video.
  * - `on`: Record video for each test.
  * - `retain-on-failure`: Record video for each test, but remove all videos from successful test runs.
  * - `retry-with-video`: Record video only when retrying a test.
  */
  video: 'off' | 'on' | 'retain-on-failure' | 'retry-with-video';

  /**
   * Whether to automatically download all the attachments. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  acceptDownloads: boolean | undefined;

  /**
   * Toggles bypassing page's Content-Security-Policy. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  bypassCSP: boolean | undefined;

  /**
   * Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`.
   * @see BrowserContextOptions
   */
  colorScheme: ColorScheme | undefined;

  /**
   * Specify device scale factor (can be thought of as dpr). Defaults to `1`.
   * @see BrowserContextOptions
   */
  deviceScaleFactor: number | undefined;

  /**
   * An object containing additional HTTP headers to be sent with every request. All header values must be strings.
   * @see BrowserContextOptions
   */
  extraHTTPHeaders: ExtraHTTPHeaders | undefined;

  /**
   * Context geolocation. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  geolocation: Geolocation | undefined;

  /**
   * Specifies if viewport supports touch events. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  hasTouch: boolean | undefined;

  /**
   * Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
   * @see BrowserContextOptions
   */
  httpCredentials: HTTPCredentials | undefined;

  /**
   * Whether to ignore HTTPS errors during navigation. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  ignoreHTTPSErrors: boolean | undefined;

  /**
   * Whether the `meta viewport` tag is taken into account and touch events are enabled. Not supported in Firefox.
   * @see BrowserContextOptions
   */
  isMobile: boolean | undefined;

  /**
   * Whether or not to enable JavaScript in the context. Defaults to `true`.
   * @see BrowserContextOptions
   */
  javaScriptEnabled: boolean | undefined;

  /**
   * User locale, for example `en-GB`, `de-DE`, etc. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  locale: string | undefined;

  /**
   * Whether to emulate network being offline.
   * @see BrowserContextOptions
   */
  offline: boolean | undefined;

  /**
   * A list of permissions to grant to all pages in this context. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  permissions: string[] | undefined;

  /**
   * Proxy setting used for all pages in the test. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  proxy: Proxy | undefined;

  /**
   * Populates context with given storage state. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  storageState: StorageState | undefined;

  /**
   * Changes the timezone of the context. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  timezoneId: string | undefined;

  /**
   * Specific user agent to use in this context.
   * @see BrowserContextOptions
   */
  userAgent: string | undefined;

  /**
   * Viewport used for all pages in the test. Takes priority over `contextOptions`.
   * @see BrowserContextOptions
   */
  viewport: ViewportSize | undefined;

  /**
   * Options used to create the context. Other options above (e.g. `viewport`) take priority.
   * @see BrowserContextOptions
   */
  contextOptions: BrowserContextOptions;
};


/**
 * Arguments available to the test function and all hooks (beforeEach, afterEach, beforeAll, afterAll).
 */
export type PlaywrightWorkerArgs = {
  /**
   * The Playwright instance.
   */
  playwright: typeof import('..');

  /**
   * Browser instance, shared between multiple tests.
   */
  browser: Browser;
};

/**
 * Arguments available to the test function and beforeEach/afterEach hooks.
 */
export type PlaywrightTestArgs = {
  /**
   * BrowserContext instance, created fresh for each test.
   */
  context: BrowserContext;

  /**
   * Page instance, created fresh for each test.
   */
  page: Page;
};

export type PlaywrightTestProject<TestArgs = {}, WorkerArgs = {}> = Project<PlaywrightTestOptions & TestArgs, PlaywrightWorkerOptions & WorkerArgs>;
export type PlaywrightTestConfig<TestArgs = {}, WorkerArgs = {}> = Config<PlaywrightTestOptions & TestArgs, PlaywrightWorkerOptions & WorkerArgs>;

/**
 * These tests are executed in Playwright environment that launches the browser
 * and provides a fresh page to each test.
 */
export const test: TestType<PlaywrightTestArgs & PlaywrightTestOptions, PlaywrightWorkerArgs & PlaywrightWorkerOptions>;
export default test;

export const _baseTest: TestType<{}, {}>;
export const expect: Expect;

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
