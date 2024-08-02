"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.applyRepeatEachIndex = applyRepeatEachIndex;
exports.bindFileSuiteToProject = bindFileSuiteToProject;
exports.filterByFocusedLine = filterByFocusedLine;
exports.filterByTestIds = filterByTestIds;
exports.filterOnly = filterOnly;
exports.filterSuite = filterSuite;
exports.filterSuiteWithOnlySemantics = filterSuiteWithOnlySemantics;
exports.filterTestsRemoveEmptySuites = filterTestsRemoveEmptySuites;
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _util = require("../util");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

function filterSuite(suite, suiteFilter, testFilter) {
  for (const child of suite.suites) {
    if (!suiteFilter(child)) filterSuite(child, suiteFilter, testFilter);
  }
  const filteredTests = suite.tests.filter(testFilter);
  const entries = new Set([...suite.suites, ...filteredTests]);
  suite._entries = suite._entries.filter(e => entries.has(e)); // Preserve the order.
}
function filterTestsRemoveEmptySuites(suite, filter) {
  const filteredSuites = suite.suites.filter(child => filterTestsRemoveEmptySuites(child, filter));
  const filteredTests = suite.tests.filter(filter);
  const entries = new Set([...filteredSuites, ...filteredTests]);
  suite._entries = suite._entries.filter(e => entries.has(e)); // Preserve the order.
  return !!suite._entries.length;
}
function bindFileSuiteToProject(project, suite) {
  const relativeFile = _path.default.relative(project.project.testDir, suite.location.file);
  const fileId = (0, _utils.calculateSha1)((0, _utils.toPosixPath)(relativeFile)).slice(0, 20);

  // Clone suite.
  const result = suite._deepClone();
  result._fileId = fileId;

  // Assign test properties with project-specific values.
  result.forEachTest((test, suite) => {
    var _inheritedRetries, _inheritedTimeout;
    suite._fileId = fileId;
    // At the point of the query, suite is not yet attached to the project, so we only get file, describe and test titles.
    const [file, ...titles] = test.titlePath();
    const testIdExpression = `[project=${project.id}]${(0, _utils.toPosixPath)(file)}\x1e${titles.join('\x1e')}`;
    const testId = fileId + '-' + (0, _utils.calculateSha1)(testIdExpression).slice(0, 20);
    test.id = testId;
    test._projectId = project.id;

    // Inherit properties from parent suites.
    let inheritedRetries;
    let inheritedTimeout;
    test.annotations = [];
    for (let parentSuite = suite; parentSuite; parentSuite = parentSuite.parent) {
      if (parentSuite._staticAnnotations.length) test.annotations = [...parentSuite._staticAnnotations, ...test.annotations];
      if (inheritedRetries === undefined && parentSuite._retries !== undefined) inheritedRetries = parentSuite._retries;
      if (inheritedTimeout === undefined && parentSuite._timeout !== undefined) inheritedTimeout = parentSuite._timeout;
    }
    test.retries = (_inheritedRetries = inheritedRetries) !== null && _inheritedRetries !== void 0 ? _inheritedRetries : project.project.retries;
    test.timeout = (_inheritedTimeout = inheritedTimeout) !== null && _inheritedTimeout !== void 0 ? _inheritedTimeout : project.project.timeout;
    test.annotations.push(...test._staticAnnotations);

    // Skip annotations imply skipped expectedStatus.
    if (test.annotations.some(a => a.type === 'skip' || a.type === 'fixme')) test.expectedStatus = 'skipped';

    // We only compute / set digest in the runner.
    if (test._poolDigest) test._workerHash = `${project.id}-${test._poolDigest}-0`;
  });
  return result;
}
function applyRepeatEachIndex(project, fileSuite, repeatEachIndex) {
  // Assign test properties with project-specific values.
  fileSuite.forEachTest((test, suite) => {
    if (repeatEachIndex) {
      const [file, ...titles] = test.titlePath();
      const testIdExpression = `[project=${project.id}]${(0, _utils.toPosixPath)(file)}\x1e${titles.join('\x1e')} (repeat:${repeatEachIndex})`;
      const testId = suite._fileId + '-' + (0, _utils.calculateSha1)(testIdExpression).slice(0, 20);
      test.id = testId;
      test.repeatEachIndex = repeatEachIndex;
      if (test._poolDigest) test._workerHash = `${project.id}-${test._poolDigest}-${repeatEachIndex}`;
    }
  });
}
function filterOnly(suite) {
  if (!suite._getOnlyItems().length) return;
  const suiteFilter = suite => suite._only;
  const testFilter = test => test._only;
  return filterSuiteWithOnlySemantics(suite, suiteFilter, testFilter);
}
function filterSuiteWithOnlySemantics(suite, suiteFilter, testFilter) {
  const onlySuites = suite.suites.filter(child => filterSuiteWithOnlySemantics(child, suiteFilter, testFilter) || suiteFilter(child));
  const onlyTests = suite.tests.filter(testFilter);
  const onlyEntries = new Set([...onlySuites, ...onlyTests]);
  if (onlyEntries.size) {
    suite._entries = suite._entries.filter(e => onlyEntries.has(e)); // Preserve the order.
    return true;
  }
  return false;
}
function filterByFocusedLine(suite, focusedTestFileLines) {
  if (!focusedTestFileLines.length) return;
  const matchers = focusedTestFileLines.map(createFileMatcherFromFilter);
  const testFileLineMatches = (testFileName, testLine, testColumn) => matchers.some(m => m(testFileName, testLine, testColumn));
  const suiteFilter = suite => !!suite.location && testFileLineMatches(suite.location.file, suite.location.line, suite.location.column);
  const testFilter = test => testFileLineMatches(test.location.file, test.location.line, test.location.column);
  return filterSuite(suite, suiteFilter, testFilter);
}
function filterByTestIds(suite, testIdMatcher) {
  if (!testIdMatcher) return;
  filterTestsRemoveEmptySuites(suite, test => testIdMatcher(test.id));
}
function createFileMatcherFromFilter(filter) {
  const fileMatcher = (0, _util.createFileMatcher)(filter.re || filter.exact || '');
  return (testFileName, testLine, testColumn) => fileMatcher(testFileName) && (filter.line === testLine || filter.line === null) && (filter.column === testColumn || filter.column === null);
}