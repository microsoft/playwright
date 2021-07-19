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

import type { FullConfig, TestStatus, TestError } from './test';
export type { FullConfig, TestStatus, TestError } from './test';

/**
 * Location where TestCase or Suite was defined.
 */
export interface Location {
  /**
   * Path to the file.
   */
  file: string;

  /**
   * Line number in the file.
   */
  line: number;

  /**
   * Column number in the file.
   */
  column: number;
}

/**
 * A group of tests. All tests are reported in the following hierarchy:
 * - Root suite
 *   - Project suite #1 (for each project)
 *     - File suite #1 (for each file in the project)
 *       - Suites for any describe() calls
 *         - TestCase #1 defined in the file or describe() group
 *         - TestCase #2
 *         ... < more test cases >
 *     - File suite #2
 *     ... < more file suites >
 *   - Second project suite
 *   ... < more project suites >
 */
export interface Suite {
  /**
   * Suite title:
   *   - Empty for root suite.
   *   - Project name for project suite.
   *   - File path for file suite.
   *   - Title passed to describe() for describe suites.
   */
  title: string;

  /**
   * Location where the suite is defined.
   */
  location?: Location;

  /**
   * Child suites.
   */
  suites: Suite[];

  /**
   * Test cases in the suite. Note that only test cases defined directly in this suite
   * are in the list. Any test cases defined in nested describe() groups are listed
   * in the child `suites`.
   */
  tests: TestCase[];

  /**
   * A list of titles from the root down to this suite.
   */
  titlePath(): string[];

  /**
   * Returns the list of all test cases in this suite and its descendants.
   */
  allTests(): TestCase[];
}

/**
 * `TestCase` corresponds to a test() call in a test file. When a single test() is
 * running in multiple projects or repeated multiple times, it will have multiple
 * `TestCase` objects in corresponding projects' suites.
 */
export interface TestCase {
  /**
   * Test title as passed to the test() call.
   */
  title: string;

  /**
   * Location where the test is defined.
   */
  location: Location;

  /**
   * A list of titles from the root down to this test.
   */
  titlePath(): string[];

  /**
   * Expected status.
   *   - Tests marked as test.skip() or test.fixme() are expected to be 'skipped'.
   *   - Tests marked as test.fail() are expected to be 'failed'.
   *   - Other tests are expected to be 'passed'.
   */
  expectedStatus: TestStatus;

  /**
   * The timeout given to the test. Affected by timeout in the configuration file,
   * and calls to test.setTimeout() or test.slow().
   */
  timeout: number;

  /**
   * Annotations collected for this test. For example, calling
   * `test.skip(true, 'just because')` will produce an annotation
   * `{ type: 'skip', description: 'just because' }`.
   */
  annotations: { type: string, description?: string }[];

  /**
   * The maxmium number of retries given to this test in the configuration.
   */
  retries: number;

  /**
   * Results for each run of this test.
   */
  results: TestResult[];

  /**
   * Testing outcome for this test. Note that outcome does not directly match to the status:
   *   - Test that is expected to fail and actually fails is 'expected'.
   *   - Test that passes on a second retry is 'flaky'.
   */
  outcome(): 'skipped' | 'expected' | 'unexpected' | 'flaky';

  /**
   * Whether the test is considered running fine.
   * Non-ok tests fail the test run with non-zero exit code.
   */
  ok(): boolean;
}

/**
 * A result of a single test run.
 */
export interface TestResult {
  /**
   * When test is retries multiple times, each retry attempt is given a sequential number.
   */
  retry: number;

  /**
   * Index of the worker where the test was run.
   */
  workerIndex: number;

  /**
   * Test run start time.
   */
  startTime: Date;

  /**
   * Running time in milliseconds.
   */
  duration: number;

  /**
   * The status of this test result.
   */
  status?: TestStatus;

  /**
   * An error from this test result, if any.
   */
  error?: TestError;

  /**
   * Any attachments created during the test run.
   */
  attachments: { name: string, path?: string, body?: Buffer, contentType: string }[];

  /**
   * Anything written to the standard output during the test run.
   */
  stdout: (string | Buffer)[];

  /**
   * Anything written to the standard error during the test run.
   */
  stderr: (string | Buffer)[];
}

/**
 * Result of the full test run.
 */
export interface FullResult {
  /**
   * Status:
   *   - 'passed' - everything went as expected.
   *   - 'failed' - any test has failed.
   *   - 'timedout' - the global time has been reached.
   *   - 'interrupted' - interrupted by the user.
   */
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
}

/**
 * Test runner notifies reporter about various events during the test run.
 */
export interface Reporter {
  /**
   * Called once before running tests.
   * All tests have been already discovered and put into a hierarchy, see `Suite` description.
   */
  onBegin?(config: FullConfig, suite: Suite): void;

  /**
   * Called after a test has been started in the worker process.
   */
  onTestBegin?(test: TestCase): void;

  /**
   * Called when something has been written to the standard output in the worker process.
   * When `test` is given, output happened while the test was running.
   */
  onStdOut?(chunk: string | Buffer, test?: TestCase): void;

  /**
   * Called when something has been written to the standard error in the worker process.
   * When `test` is given, output happened while the test was running.
   */
  onStdErr?(chunk: string | Buffer, test?: TestCase): void;

  /**
   * Called after a test has been finished in the worker process.
   */
  onTestEnd?(test: TestCase, result: TestResult): void;

  /**
   * Called on some global error, for example unhandled expection in the worker process.
   */
  onError?(error: TestError): void;

  /**
   * Called after all tests has been run, or when testing has been interrupted.
   */
  onEnd?(result: FullResult): void | Promise<void>;
}

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
