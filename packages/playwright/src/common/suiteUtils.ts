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
import { sanitizeForFilePath, toPosixPath, trimLongString } from '@utils/fileUtils';

import { createFileMatcher, forceRegExp, parseLocationArg, windowsFilesystemFriendlyLength } from '../util';

import type { FullProjectInternal } from './config';
import type { Suite, TestCase } from './test';
import type { Matcher, TestCaseFilter } from '../util';

export function testOutputDirBase(requireFile: string, titlePath: string[], testDir: string, projectId: string, collisionSuffix = '') {
  const relativeTestFilePath = path.relative(testDir, requireFile.replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/, ''));
  const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
  const fullTitleWithoutSpec = titlePath.slice(1).join(' ');
  const maxLength = windowsFilesystemFriendlyLength - (collisionSuffix ? collisionSuffix.length + 1 : 0);
  let testOutputDir = trimLongString(sanitizedRelativePath + '-' + sanitizeForFilePath(fullTitleWithoutSpec), maxLength);
  if (collisionSuffix)
    testOutputDir += '-' + collisionSuffix;
  if (projectId)
    testOutputDir += '-' + sanitizeForFilePath(projectId);
  return testOutputDir;
}

export function filterTestsRemoveEmptySuites(suite: Suite, filter: TestCaseFilter): boolean {
  const filteredSuites = suite.suites.filter(child => filterTestsRemoveEmptySuites(child, filter));
  const filteredTests = suite.tests.filter(filter);
  const entries = new Set([...filteredSuites, ...filteredTests]);
  suite._entries = suite._entries.filter(e => entries.has(e)); // Preserve the order.
  return !!suite._entries.length;
}

type OutputDirEntry = {
  test: TestCase;
  project: FullProjectInternal;
  titlePath: string[];
  repeatEach: number;
  suffix: string;
  outputDir: string;
};

const maxOutputDirPasses = 3;

export function assignTestOutputDirSuffixes(projectSuites: Map<FullProjectInternal, Suite>) {
  const entries: OutputDirEntry[] = [];
  for (const [project, suite] of projectSuites) {
    const repeatEach = Math.max(project.project.repeatEach, project.fullConfig.configCLIOverrides.repeatEach ?? 0);
    for (const test of suite.allTests()) {
      // Workers build the title path without the project suite.
      const entry = { test, project, titlePath: test.titlePath().slice(1), repeatEach, suffix: '', outputDir: '' };
      entry.outputDir = normalizedOutputDir(entry);
      entries.push(entry);
    }
  }

  for (let pass = 1; pass <= maxOutputDirPasses; pass++) {
    const collidingEntries = findCollidingEntries(entries);
    if (!collidingEntries.size)
      break;
    // Test ids end with a 20-character hash that is unique per test. Use all of it on the last pass.
    const hashLength = pass < maxOutputDirPasses ? 12 : 20;
    for (const entry of collidingEntries) {
      entry.suffix = entry.test.id.slice(-hashLength);
      entry.outputDir = normalizedOutputDir(entry);
    }
  }

  for (const entry of entries)
    entry.test._outputDirSuffix = entry.suffix;
}

function normalizedOutputDir(entry: OutputDirEntry): string {
  const { test, project } = entry;
  const outputDir = path.join(project.project.outputDir, testOutputDirBase(test._requireFile, entry.titlePath, project.project.testDir, project.id, entry.suffix));
  if (process.platform === 'win32')
    return outputDir.toLowerCase();
  // Treat all macOS volumes as case-insensitive. On a case-sensitive volume, this only adds a suffix to titles that differ by case.
  if (process.platform === 'darwin')
    return outputDir.normalize('NFD').toLowerCase();
  return outputDir;
}

function findCollidingEntries(entries: OutputDirEntry[]): Set<OutputDirEntry> {
  const entriesByOutputDir = new Map<string, OutputDirEntry[]>();
  for (const entry of entries) {
    const sameOutputDir = entriesByOutputDir.get(entry.outputDir);
    if (sameOutputDir)
      sameOutputDir.push(entry);
    else
      entriesByOutputDir.set(entry.outputDir, [entry]);
  }

  const collidingEntries = new Set<OutputDirEntry>();
  for (const entry of entries) {
    if (entriesByOutputDir.get(entry.outputDir)!.length > 1)
      collidingEntries.add(entry);

    // Tests with different base dirs can only clash when the base dir of one test is a retry or repeat
    // dir of the other test. For example, "a-same-retry1" is also the first retry of "a-same".
    // Check this for each base dir, instead of listing all retry and repeat dirs of all tests.
    for (const { baseDir, retry, repeat } of retryAndRepeatOrigins(entry.outputDir)) {
      for (const other of entriesByOutputDir.get(baseDir) ?? []) {
        if (retry <= other.test.retries && repeat < other.repeatEach) {
          collidingEntries.add(entry);
          collidingEntries.add(other);
        }
      }
    }
  }
  return collidingEntries;
}

// "a-retry1-repeat2" is the dir of "a" for retry 1 and repeat 2, and the dir of "a-retry1" for repeat 2.
function retryAndRepeatOrigins(outputDir: string): { baseDir: string, retry: number, repeat: number }[] {
  const origins = [];
  const retryMatch = /-retry([1-9]\d*)(?:-repeat([1-9]\d*))?$/.exec(outputDir);
  if (retryMatch)
    origins.push({ baseDir: outputDir.slice(0, retryMatch.index), retry: +retryMatch[1], repeat: +(retryMatch[2] ?? 0) });
  const repeatMatch = /-repeat([1-9]\d*)$/.exec(outputDir);
  if (repeatMatch)
    origins.push({ baseDir: outputDir.slice(0, repeatMatch.index), retry: 0, repeat: +repeatMatch[1] });
  return origins;
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
    for (let parentSuite: Suite | undefined = suite; parentSuite; parentSuite = parentSuite.parent) {
      if (parentSuite._staticAnnotations.length)
        test.annotations.unshift(...parentSuite._staticAnnotations);
      if (parentSuite._parallelMode === 'serial')
        test.annotations.unshift({ type: 'serial', location: parentSuite.location });
      if (parentSuite._locks.length)
        test._locks.push(...parentSuite._locks);
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

export function filterOnly(suite: Suite) {
  if (!suite._getOnlyItems().length)
    return;
  const suiteFilter = (suite: Suite) => suite._only;
  const testFilter = (test: TestCase) => test._only;
  return filterSuiteWithOnlySemantics(suite, suiteFilter, testFilter);
}

function filterSuiteWithOnlySemantics(suite: Suite, suiteFilter: (suite: Suite) => boolean, testFilter: TestCaseFilter) {
  const onlySuites = suite.suites.filter(child => filterSuiteWithOnlySemantics(child, suiteFilter, testFilter) || suiteFilter(child));
  const onlyTests = suite.tests.filter(testFilter);
  const onlyEntries = new Set([...onlySuites, ...onlyTests]);
  if (onlyEntries.size) {
    suite._entries = suite._entries.filter(e => onlyEntries.has(e)); // Preserve the order.
    return true;
  }
  return false;
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
