"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.serializePatterns = serializePatterns;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _base = require("./base");
var _utils = require("playwright-core/lib/utils");
var _config = require("../common/config");
var _empty = _interopRequireDefault(require("./empty"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

class JSONReporter extends _empty.default {
  constructor(options) {
    var _resolveOutputFile;
    super();
    this.config = void 0;
    this.suite = void 0;
    this._errors = [];
    this._resolvedOutputFile = void 0;
    this._resolvedOutputFile = (_resolveOutputFile = (0, _base.resolveOutputFile)('JSON', options)) === null || _resolveOutputFile === void 0 ? void 0 : _resolveOutputFile.outputFile;
  }
  printsToStdio() {
    return !this._resolvedOutputFile;
  }
  onConfigure(config) {
    this.config = config;
  }
  onBegin(suite) {
    this.suite = suite;
  }
  onError(error) {
    this._errors.push(error);
  }
  async onEnd(result) {
    await outputReport(this._serializeReport(result), this._resolvedOutputFile);
  }
  _serializeReport(result) {
    const report = {
      config: {
        ...removePrivateFields(this.config),
        rootDir: (0, _utils.toPosixPath)(this.config.rootDir),
        projects: this.config.projects.map(project => {
          return {
            outputDir: (0, _utils.toPosixPath)(project.outputDir),
            repeatEach: project.repeatEach,
            retries: project.retries,
            metadata: project.metadata,
            id: (0, _config.getProjectId)(project),
            name: project.name,
            testDir: (0, _utils.toPosixPath)(project.testDir),
            testIgnore: serializePatterns(project.testIgnore),
            testMatch: serializePatterns(project.testMatch),
            timeout: project.timeout
          };
        })
      },
      suites: this._mergeSuites(this.suite.suites),
      errors: this._errors,
      stats: {
        startTime: result.startTime.toISOString(),
        duration: result.duration,
        expected: 0,
        skipped: 0,
        unexpected: 0,
        flaky: 0
      }
    };
    for (const test of this.suite.allTests()) ++report.stats[test.outcome()];
    return report;
  }
  _mergeSuites(suites) {
    const fileSuites = new _utils.MultiMap();
    for (const projectSuite of suites) {
      const projectId = (0, _config.getProjectId)(projectSuite.project());
      const projectName = projectSuite.project().name;
      for (const fileSuite of projectSuite.suites) {
        const file = fileSuite.location.file;
        const serialized = this._serializeSuite(projectId, projectName, fileSuite);
        if (serialized) fileSuites.set(file, serialized);
      }
    }
    const results = [];
    for (const [, suites] of fileSuites) {
      const result = {
        title: suites[0].title,
        file: suites[0].file,
        column: 0,
        line: 0,
        specs: []
      };
      for (const suite of suites) this._mergeTestsFromSuite(result, suite);
      results.push(result);
    }
    return results;
  }
  _relativeLocation(location) {
    if (!location) return {
      file: '',
      line: 0,
      column: 0
    };
    return {
      file: (0, _utils.toPosixPath)(_path.default.relative(this.config.rootDir, location.file)),
      line: location.line,
      column: location.column
    };
  }
  _locationMatches(s1, s2) {
    return s1.file === s2.file && s1.line === s2.line && s1.column === s2.column;
  }
  _mergeTestsFromSuite(to, from) {
    for (const fromSuite of from.suites || []) {
      const toSuite = (to.suites || []).find(s => s.title === fromSuite.title && this._locationMatches(s, fromSuite));
      if (toSuite) {
        this._mergeTestsFromSuite(toSuite, fromSuite);
      } else {
        if (!to.suites) to.suites = [];
        to.suites.push(fromSuite);
      }
    }
    for (const spec of from.specs || []) {
      const toSpec = to.specs.find(s => s.title === spec.title && s.file === (0, _utils.toPosixPath)(_path.default.relative(this.config.rootDir, spec.file)) && s.line === spec.line && s.column === spec.column);
      if (toSpec) toSpec.tests.push(...spec.tests);else to.specs.push(spec);
    }
  }
  _serializeSuite(projectId, projectName, suite) {
    if (!suite.allTests().length) return null;
    const suites = suite.suites.map(suite => this._serializeSuite(projectId, projectName, suite)).filter(s => s);
    return {
      title: suite.title,
      ...this._relativeLocation(suite.location),
      specs: suite.tests.map(test => this._serializeTestSpec(projectId, projectName, test)),
      suites: suites.length ? suites : undefined
    };
  }
  _serializeTestSpec(projectId, projectName, test) {
    return {
      title: test.title,
      ok: test.ok(),
      tags: test.tags.map(tag => tag.substring(1)),
      // Strip '@'.
      tests: [this._serializeTest(projectId, projectName, test)],
      id: test.id,
      ...this._relativeLocation(test.location)
    };
  }
  _serializeTest(projectId, projectName, test) {
    return {
      timeout: test.timeout,
      annotations: test.annotations,
      expectedStatus: test.expectedStatus,
      projectId,
      projectName,
      results: test.results.map(r => this._serializeTestResult(r, test)),
      status: test.outcome()
    };
  }
  _serializeTestResult(result, test) {
    var _result$error;
    const steps = result.steps.filter(s => s.category === 'test.step');
    const jsonResult = {
      workerIndex: result.workerIndex,
      status: result.status,
      duration: result.duration,
      error: result.error,
      errors: result.errors.map(e => this._serializeError(e)),
      stdout: result.stdout.map(s => stdioEntry(s)),
      stderr: result.stderr.map(s => stdioEntry(s)),
      retry: result.retry,
      steps: steps.length ? steps.map(s => this._serializeTestStep(s)) : undefined,
      startTime: result.startTime.toISOString(),
      attachments: result.attachments.map(a => {
        var _a$body;
        return {
          name: a.name,
          contentType: a.contentType,
          path: a.path,
          body: (_a$body = a.body) === null || _a$body === void 0 ? void 0 : _a$body.toString('base64')
        };
      })
    };
    if ((_result$error = result.error) !== null && _result$error !== void 0 && _result$error.stack) jsonResult.errorLocation = (0, _base.prepareErrorStack)(result.error.stack).location;
    return jsonResult;
  }
  _serializeError(error) {
    return (0, _base.formatError)(error, true);
  }
  _serializeTestStep(step) {
    const steps = step.steps.filter(s => s.category === 'test.step');
    return {
      title: step.title,
      duration: step.duration,
      error: step.error,
      steps: steps.length ? steps.map(s => this._serializeTestStep(s)) : undefined
    };
  }
}
async function outputReport(report, resolvedOutputFile) {
  const reportString = JSON.stringify(report, undefined, 2);
  if (resolvedOutputFile) {
    await _fs.default.promises.mkdir(_path.default.dirname(resolvedOutputFile), {
      recursive: true
    });
    await _fs.default.promises.writeFile(resolvedOutputFile, reportString);
  } else {
    console.log(reportString);
  }
}
function stdioEntry(s) {
  if (typeof s === 'string') return {
    text: s
  };
  return {
    buffer: s.toString('base64')
  };
}
function removePrivateFields(config) {
  return Object.fromEntries(Object.entries(config).filter(([name, value]) => !name.startsWith('_')));
}
function serializePatterns(patterns) {
  if (!Array.isArray(patterns)) patterns = [patterns];
  return patterns.map(s => s.toString());
}
var _default = exports.default = JSONReporter;