/**
* Copyright Microsoft Corporation. All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import path from 'path';

import { calculateSha1 } from '@utils/crypto';
import { toPosixPath } from '@utils/fileUtils';

import { createFileMatcher, forceRegExp, parseLocationArg } from '../util';

import type { FullProjectInternal } from './config';
import type { Suite, TestCase } from './test';
import type { Matcher, TestCaseFilter } from '../util';

export function bindFileSuiteToProject(project: FullProjectInternal, suite: Suite): Suite {
  const relativeFile = path.relative(project.project.testDir, suite.location!.file);
  const fileId = calculateSha1(toPosixPath(relativeFile)).slice(0, 20);

  // Clone suite.
  const result = suite._deepClone();
  result._fileId = fileId;

  // Assign test properties with project-specific values.
  result.forEachTest((test, suite) => {
    suite._fileId = fileId;
    // At the point of the query, suite is not yet attached to the project, so we only get file, describe and test titles.
    const [file, ...titles] = test.titlePath();
    const testIdExpression = `[project=${project.id}]${toPosixPath(file)}\x1e${titles.join('\x1e')}`;
    const testId = fileId + '-' + calculateSha1(testIdExpression).slice(0, 20);
    test.id = testId;
    test._projectId = project.id;

    // Inherit properties from parent suites.
    let inheritedRetries: number | undefined;
    let inheritedTimeout: number | undefined;
    for (let parentSuite: Suite | undefined = suite; parentSuite; parentSuite = parentSuite.parent) {
      if (parentSuite._staticAnnotations.length)
        test.annotations.unshift(...parentSuite._staticAnnotations);
      if (inheritedRetries === undefined && parentSuite._retries !== undefined)
        inheritedRetries = parentSuite._retries;
      if (inheritedTimeout === undefined && parentSuite._timeout !== undefined)
        inheritedTimeout = parentSuite._timeout;
    }
    test.retries = inheritedRetries ?? project.project.retries;
    test.timeout = inheritedTimeout ?? project.project.timeout;

    // Skip annotations imply skipped expectedStatus.
    if (test.annotations.some(a => a.type === 'skip' || a.type === 'fixme'))
      test.expectedStatus = 'skipped';

    // We only compute / set digest in the runner.
    if (test._poolDigest)
      test._workerHash = `${project.id}-${test._poolDigest}-0`;
  });

  return result;
}

export function applyRepeatEachIndex(project: FullProjectInternal, fileSuite: Suite, repeatEachIndex: number) {
  // Assign test properties with project-specific values.
  fileSuite.forEachTest((test, suite) => {
    if (repeatEachIndex) {
      const [file, ...titles] = test.titlePath();
      const testIdExpression = `[project=${project.id}]${toPosixPath(file)}\x1e${titles.join('\x1e')} (repeat:${repeatEachIndex})`;
      const testId = suite._fileId + '-' + calculateSha1(testIdExpression).slice(0, 20);
      test.id = testId;
      test.repeatEachIndex = repeatEachIndex;

      if (test._poolDigest)
        test._workerHash = `${project.id}-${test._poolDigest}-${repeatEachIndex}`;
    }
  });
}

export function filterOnly(suite: Suite): boolean {
  const toExclude: (Suite | TestCase)[] = [];
  let hasOnlyInside = false;
  for (const child of suite.suites) {
    if (filterOnly(child))
      hasOnlyInside = true;
    else
      toExclude.push(child);
  }
  for (const test of suite.tests) {
    if (test._only)
      hasOnlyInside = true;
    else
      toExclude.push(test);
  }
  if (hasOnlyInside) {
    for (const e of toExclude)
      e.exclude();
    return true;
  }
  return !!suite._only;
}

export function createFiltersFromArguments(args: string[]): { fileFilter: Matcher, testFilter: TestCaseFilter } {
  const matchers = args.map(arg => {
    const parsed = parseLocationArg(arg);
    const fileMatcher = createFileMatcher(forceRegExp(parsed.file));
    const locationMatcher = (file: string, line: number, column: number) => fileMatcher(file) && (parsed.line === line || parsed.line === null) && (parsed.column === column || parsed.column === null);
    return { fileMatcher, locationMatcher };
  });

  const fileFilter = (file: string) => matchers.some(m => m.fileMatcher(file));
  const locationMatcher = (file: string, line: number, column: number) => matchers.some(m => m.locationMatcher(file, line, column));
  const testFilter = (test: TestCase) => {
    // If any suite matches the filter, always include all tests.
    for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
      if (suite.location && locationMatcher(suite.location.file, suite.location.line, suite.location.column))
        return true;
    }
    return locationMatcher(test.location.file, test.location.line, test.location.column);
  };
  return { fileFilter, testFilter };
}
