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
import { calculateSha1, toPosixPath } from 'playwright-core/lib/utils';
import type { Suite, TestCase } from './test';
import type { FullProjectInternal } from './config';
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
    test.annotations = [];
    for (let parentSuite: Suite | undefined = suite; parentSuite; parentSuite = parentSuite.parent) {
      if (parentSuite._staticAnnotations.length)
        test.annotations = [...parentSuite._staticAnnotations, ...test.annotations];
      if (inheritedRetries === undefined && parentSuite._retries !== undefined)
        inheritedRetries = parentSuite._retries;
      if (inheritedTimeout === undefined && parentSuite._timeout !== undefined)
        inheritedTimeout = parentSuite._timeout;
    }
    test.retries = inheritedRetries ?? project.project.retries;
    test.timeout = inheritedTimeout ?? project.project.timeout;
    test.annotations.push(...test._staticAnnotations);

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
