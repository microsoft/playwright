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

import type { TestStatus, Metadata, PlaywrightTestOptions, PlaywrightWorkerOptions, ReporterDescription, FullConfig, FullProject } from './test';
export type { FullConfig, FullProject, TestStatus } from './test';

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

  /**
   * Test start wall time.
   */
  startTime: Date;

  /**
   * Test duration in milliseconds.
   */
  duration: number;
}

export interface Reporter {
  onEnd?(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined | void> | void;
}

export interface JSONReport {
  config: Omit<FullConfig, 'projects'> & {
    projects: {
      outputDir: string,
      repeatEach: number,
      retries: number,
      metadata: Metadata,
      id: string,
      name: string,
      testDir: string,
      testIgnore: string[],
      testMatch: string[],
      timeout: number,
    }[],
  };
  suites: JSONReportSuite[];
  errors: TestError[];
  stats: {
    startTime: string; // Date in ISO 8601 format.
    duration: number; // In milliseconds;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  }
}

export interface JSONReportSuite {
  title: string;
  file: string;
  column: number;
  line: number;
  specs: JSONReportSpec[];
  suites?: JSONReportSuite[];
}

export interface JSONReportSpec {
  tags: string[],
  title: string;
  ok: boolean;
  tests: JSONReportTest[];
  id: string;
  file: string;
  line: number;
  column: number;
}

export interface JSONReportTest {
  timeout: number;
  annotations: { type: string, description?: string }[],
  expectedStatus: TestStatus;
  projectName: string;
  projectId: string;
  results: JSONReportTestResult[];
  status: 'skipped' | 'expected' | 'unexpected' | 'flaky';
}

export interface JSONReportError {
  message: string;
  location?: Location;
}

export interface JSONReportTestResult {
  workerIndex: number;
  status: TestStatus | undefined;
  duration: number;
  error: TestError | undefined;
  errors: JSONReportError[];
  stdout: JSONReportSTDIOEntry[];
  stderr: JSONReportSTDIOEntry[];
  retry: number;
  steps?: JSONReportTestStep[];
  startTime: string; // Date in ISO 8601 format.
  attachments: {
    name: string;
    path?: string;
    body?: string;
    contentType: string;
  }[];
  errorLocation?: Location;
}

export interface JSONReportTestStep {
  title: string;
  duration: number;
  error: TestError | undefined;
  steps?: JSONReportTestStep[];
}

export type JSONReportSTDIOEntry = { text: string } | { buffer: string };

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
