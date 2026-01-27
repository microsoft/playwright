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

import { z as zod } from 'playwright-core/lib/mcpBundle';
import {
  nonNegativeNumber,
  stringOrArray,
  stringOrArrayOptional,
  workersOrPercentage,
  regExpOrArray,
} from './base';

/**
 * Zod schema for TestConfig validation.
 *
 * Validates top-level configuration options with strict mode enabled for typo detection.
 */
export const testConfigSchema = zod.object({
  /**
   * Boolean options
   */

  /**
   * Run all tests in parallel without worker isolation.
   * @default false
   */
  fullyParallel: zod.boolean().optional(),

  /**
   * Fail the test run if any tests are marked as flaky but pass.
   * @default false
   */
  failOnFlakyTests: zod.boolean().optional(),

  /**
   * Whether to suppress stdout/stderr output.
   * @default false
   */
  quiet: zod.boolean().optional(),

  /**
   * Whether to respect .gitignore when searching for test files.
   * @default true
   */
  respectGitIgnore: zod.boolean().optional(),

  /**
   * Optional name for this configuration.
   */
  name: zod.string().optional(),

  /**
   * Numeric options
   */

  /**
   * Maximum timeout for the whole test run in milliseconds.
   * @default 0 (no timeout)
   */
  globalTimeout: nonNegativeNumber.optional(),

  /**
   * Enum options
   */

  /**
   * Which test results to preserve.
   * @default 'always'
   */
  preserveOutput: zod.enum(['always', 'never', 'failures-only']).optional(),

  /**
   * Whether to update snapshots and which ones.
   * @default 'missing'
   */
  updateSnapshots: zod.enum(['all', 'changed', 'missing', 'none']).optional(),

  /**
   * How to apply source map when updating snapshots.
   * @default 'patch'
   */
  updateSourceMethod: zod.enum(['patch', 'overwrite', '3way']).optional(),

  /**
   * When to run LLM agents.
   * @default 'missing'
   */
  runAgents: zod.enum(['all', 'missing', 'none']).optional(),

  /**
   * Array options
   */

  /**
   * Global setup files or scripts.
   * Can be a single string or an array of strings.
   */
  globalSetup: stringOrArray.optional(),

  /**
   * Global teardown files or scripts.
   * Can be a single string or an array of strings.
   */
  globalTeardown: stringOrArray.optional(),

  /**
   * Object options
   */

  /**
   * Git information capture configuration.
   */
  captureGitInfo: zod.object({
    /**
     * Whether to include commit hash in test results.
     * @default true (in CI)
     */
    commit: zod.boolean().optional(),

    /**
     * Whether to include git diff in test results.
     * @default true (in CI)
     */
    diff: zod.boolean().optional(),
  }).optional(),

  /**
   * Additional metadata to include in test results.
   * Can be any object with string keys.
   */
  metadata: zod.record(zod.string(), zod.any()).optional(),

  /**
   * Options to apply to all workers.
   * This is the `use` option in playwright.config.
   */
  use: zod.record(zod.string(), zod.any()).optional(),

  /**
   * Expect configuration.
   */
  expect: zod.object({
    /**
     * Default timeout for expect() assertions in milliseconds.
     * @default 5000
     */
    timeout: nonNegativeNumber.optional(),

    /**
     * Screenshot comparison thresholds.
     */
    toHaveScreenshot: zod.object({
      /**
       * Animation comparison threshold (0-1).
       */
      animations: zod.union([
        zod.literal('allow'),
        zod.literal('disable'),
      ]).optional(),

      /**
       * Color comparison threshold (0-1).
       */
      maxDiffPixels: zod.number().int().min(0).optional(),

      /**
       * Maximum percentage of different pixels (0-1).
       */
      threshold: zod.number().min(0).max(1).optional(),
    }).optional(),

    /**
     * Timeout configuration.
     */
    toPass: zod.object({
      /**
       * Intervals between polling attempts in milliseconds.
       * All values must be positive.
       */
      intervals: zod.array(zod.number().int().positive()).optional(),
    }).optional(),
  }).optional(),

  /**
   * Properties already validated in configLoader.ts
   * (Commented out to avoid duplication)
   */

  // forbidOnly: zod.boolean().optional(),
  // projects: zod.array(zod.any()).optional(),
  // reporter: zod.array(zod.any()).optional(),
  // reportSlowTests: zod.object({
  //   max: zod.number().int().min(0),
  //   threshold: zod.number().int().min(0),
  // }).optional(),
  // shard: zod.object({
  //   total: zod.number().int().min(1),
  //   current: zod.number().int().min(1),
  // }).optional(),
  // tsconfig: zod.string().optional(), // File existence checked separately

  /**
   * Worker & Parallelism options
   */

  /**
   * The maximum number of concurrent worker processes.
   * Can be a number or a percentage string (e.g., "50%").
   */
  workers: workersOrPercentage.optional(),

  /**
   * Maximum number of test failures before stopping the run.
   * @default 0 (no limit)
   */
  maxFailures: nonNegativeNumber.optional(),

  /**
   * Test filtering options
   */

  /**
   * Only run tests matching this pattern.
   * Can be a RegExp or an array of RegExp.
   */
  grep: regExpOrArray.optional(),

  /**
   * Only run tests NOT matching this pattern.
   * Can be a RegExp or an array of RegExp.
   */
  grepInvert: regExpOrArray.optional(),

  /**
   * Test behavior options
   */

  /**
   * Timeout for each test in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeout: nonNegativeNumber.optional(),

  /**
   * Number of retries for each test.
   * @default 0 (no retries)
   */
  retries: nonNegativeNumber.optional(),

  /**
   * Number of times to repeat each test.
   * @default 1
   */
  repeatEach: nonNegativeNumber.optional(),

  /**
   * Project configuration
   */

  /**
   * List of test projects.
   * Each project can have its own configuration.
   */
  projects: zod.array(zod.any()).optional(),

  /**
   * Reporter configuration
   */

  /**
   * Reporter(s) to use.
   * Can be a string, an array of strings, or an array of tuples [name, options].
   */
  reporter: zod.union([
    zod.string(),
    zod.array(zod.union([
      zod.string(),
      zod.tuple([zod.string(), zod.any()])
    ]))
  ]).optional(),

  /**
   * Configuration for reporting slow tests.
   */
  reportSlowTests: zod.object({
    /**
     * Maximum test duration in milliseconds before being considered slow.
     */
    max: zod.number().int().min(0).optional(),

    /**
     * Threshold in milliseconds for considering a test slow.
     */
    threshold: zod.number().int().min(0).optional(),
  }).optional().nullable(),

  /**
   * Shard configuration to split tests into shards.
   */
  shard: zod.object({
    /**
     * Total number of shards.
     */
    total: zod.number().int().min(1).optional(),

    /**
     * Current shard number (1-based).
     */
    current: zod.number().int().min(1).optional(),
  }).optional().nullable(),

  /**
   * Path to TypeScript configuration file.
   */
  tsconfig: zod.string().optional(),

  /**
   * FORBID only tests, failing when they are encountered.
   */
  forbidOnly: zod.boolean().optional(),

  /**
   * Core directory options
   */

  /**
   * Directory that will be recursively scanned for test files.
   */
  testDir: zod.string().optional(),

  /**
   * Output directory for test results.
   */
  outputDir: zod.string().optional(),

  /**
   * Root directory for relative paths.
   */
  rootDir: zod.string().optional(),

  /**
   * Snapshot directory for test snapshots.
   */
  snapshotDir: zod.string().optional(),

  /**
   * Snapshot path template.
   */
  snapshotPathTemplate: zod.string().optional(),

  /**
   * Test file matching pattern(s).
   */
  testMatch: stringOrArray.optional(),

  /**
   * Test file ignore pattern(s).
   */
  testIgnore: stringOrArray.optional(),

  /**
   * Global test tag(s).
   */
  tag: zod.union([
    zod.string(),
    zod.array(zod.string()),
  ]).optional(),

  /**
   * Web server configuration.
   */
  webServer: zod.union([
    zod.string(),
    zod.object({
      command: zod.string().optional(),
      port: zod.number().int().positive().optional(),
      url: zod.string().optional(),
      timeout: zod.number().int().positive().optional(),
      reuseExistingServer: zod.boolean().optional(),
    }),
  ]).optional().nullable(),

  /**
   * Teardown configuration.
   */
  teardown: zod.string().optional(),

  /**
   * Whether to skip snapshot expectations.
   */
  ignoreSnapshots: zod.boolean().optional(),

}).strict(); // Catch typos in config property names

// Note: Type export can be added later if needed
// export type TestConfig = zod.infer<typeof testConfigSchema>;
