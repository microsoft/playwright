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
import { calculateSha1 } from 'playwright-core/lib/utils';
import type { Suite, TestCase } from './test';
import type { FullProjectInternal } from './types';
import type { Matcher, TestFileFilter } from '../util';
import { createFileMatcher } from '../util';


export function filterSuite(suite: Suite, suiteFilter: (suites: Suite) => boolean, testFilter: (test: TestCase) => boolean) {
  for (const child of suite.suites) {
    if (!suiteFilter(child))
      filterSuite(child, suiteFilter, testFilter);
  }
  const filteredTests = suite.tests.filter(testFilter);
  const entries = new Set([...suite.suites, ...filteredTests]);
  suite._entries = suite._entries.filter(e => entries.has(e)); // Preserve the order.
}

export function filterTestsRemoveEmptySuites(suite: Suite, filter: (test: TestCase) => boolean): boolean {
  const filteredSuites = suite.suites.filter(child => filterTestsRemoveEmptySuites(child, filter));
  const filteredTests = suite.tests.filter(filter);
  const entries = new Set([...filteredSuites, ...filteredTests]);
  suite._entries = suite._entries.filter(e => entries.has(e)); // Preserve the order.
  return !!suite._entries.length;
}

export function buildFileSuiteForProject(project: FullProjectInternal, suite: Suite, repeatEachIndex: number): Suite {
  const relativeFile = path.relative(project.testDir, suite.location!.file).split(path.sep).join('/');
  const fileId = calculateSha1(relativeFile).slice(0, 20);

  // Clone suite.
  const result = suite._deepClone();
  result._fileId = fileId;

  // Assign test properties with project-specific values.
  result.forEachTest((test, suite) => {
    suite._fileId = fileId;
    const repeatEachIndexSuffix = repeatEachIndex ? ` (repeat:${repeatEachIndex})` : '';

    // At the point of the query, suite is not yet attached to the project, so we only get file, describe and test titles.
    const testIdExpression = `[project=${project._internal.id}]${test.titlePath().join('\x1e')}${repeatEachIndexSuffix}`;
    const testId = fileId + '-' + calculateSha1(testIdExpression).slice(0, 20);
    test.id = testId;
    test.repeatEachIndex = repeatEachIndex;
    test._projectId = project._internal.id;

    // Inherit properties from parent suites.
    let inheritedRetries: number | undefined;
    let inheritedTimeout: number | undefined;
    for (let parentSuite: Suite | undefined = suite; parentSuite; parentSuite = parentSuite.parent) {
      test._staticAnnotations.push(...parentSuite._staticAnnotations);
      if (inheritedRetries === undefined && parentSuite._retries !== undefined)
        inheritedRetries = parentSuite._retries;
      if (inheritedTimeout === undefined && parentSuite._timeout !== undefined)
        inheritedTimeout = parentSuite._timeout;
    }
    test.retries = inheritedRetries ?? project.retries;
    test.timeout = inheritedTimeout ?? project.timeout;

    // Skip annotations imply skipped expectedStatus.
    if (test._staticAnnotations.some(a => a.type === 'skip' || a.type === 'fixme'))
      test.expectedStatus = 'skipped';

    // We only compute / set digest in the runner.
    if (test._poolDigest)
      test._workerHash = `${project._internal.id}-${test._poolDigest}-${repeatEachIndex}`;
  });

  return result;
}

export function filterOnly(suite: Suite) {
  if (!suite._getOnlyItems().length)
    return;
  const suiteFilter = (suite: Suite) => suite._only;
  const testFilter = (test: TestCase) => test._only;
  return filterSuiteWithOnlySemantics(suite, suiteFilter, testFilter);
}

export function filterSuiteWithOnlySemantics(suite: Suite, suiteFilter: (suites: Suite) => boolean, testFilter: (test: TestCase) => boolean) {
  const onlySuites = suite.suites.filter(child => filterSuiteWithOnlySemantics(child, suiteFilter, testFilter) || suiteFilter(child));
  const onlyTests = suite.tests.filter(testFilter);
  const onlyEntries = new Set([...onlySuites, ...onlyTests]);
  if (onlyEntries.size) {
    suite._entries = suite._entries.filter(e => onlyEntries.has(e)); // Preserve the order.
    return true;
  }
  return false;
}

export function filterByFocusedLine(suite: Suite, focusedTestFileLines: TestFileFilter[]) {
  if (!focusedTestFileLines.length)
    return;
  const matchers = focusedTestFileLines.map(createFileMatcherFromFilter);
  const testFileLineMatches = (testFileName: string, testLine: number, testColumn: number) => matchers.some(m => m(testFileName, testLine, testColumn));
  const suiteFilter = (suite: Suite) => !!suite.location && testFileLineMatches(suite.location.file, suite.location.line, suite.location.column);
  const testFilter = (test: TestCase) => testFileLineMatches(test.location.file, test.location.line, test.location.column);
  return filterSuite(suite, suiteFilter, testFilter);
}

export function filterByTestIds(suite: Suite, testIdMatcher: Matcher | undefined) {
  if (!testIdMatcher)
    return;
  filterTestsRemoveEmptySuites(suite, test => testIdMatcher(test.id));
}

function createFileMatcherFromFilter(filter: TestFileFilter) {
  const fileMatcher = createFileMatcher(filter.re || filter.exact || '');
  return (testFileName: string, testLine: number, testColumn: number) =>
    fileMatcher(testFileName) && (filter.line === testLine || filter.line === null) && (filter.column === testColumn || filter.column === null);
}
