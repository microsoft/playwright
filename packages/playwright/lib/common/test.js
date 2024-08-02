"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestCase = exports.Suite = void 0;
var _testType = require("./testType");
var _teleReceiver = require("../isomorphic/teleReceiver");
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

class Base {
  constructor(title) {
    this.title = void 0;
    this._only = false;
    this._requireFile = '';
    this.title = title;
  }
}
class Suite extends Base {
  constructor(title, type, testTypeImpl) {
    super(title);
    this.location = void 0;
    this.parent = void 0;
    this._use = [];
    this._entries = [];
    this._hooks = [];
    this._timeout = void 0;
    this._retries = void 0;
    // Annotations known statically before running the test, e.g. `test.describe.skip()` or `test.describe({ annotation }, body)`.
    this._staticAnnotations = [];
    // Explicitly declared tags that are not a part of the title.
    this._tags = [];
    this._modifiers = [];
    this._parallelMode = 'none';
    this._fullProject = void 0;
    this._fileId = void 0;
    this._type = void 0;
    this._testTypeImpl = void 0;
    this._type = type;
    this._testTypeImpl = testTypeImpl;
  }
  get type() {
    return this._type;
  }
  entries() {
    return this._entries;
  }
  get suites() {
    return this._entries.filter(entry => entry instanceof Suite);
  }
  get tests() {
    return this._entries.filter(entry => entry instanceof TestCase);
  }
  _addTest(test) {
    test.parent = this;
    this._entries.push(test);
  }
  _addSuite(suite) {
    suite.parent = this;
    this._entries.push(suite);
  }
  _prependSuite(suite) {
    suite.parent = this;
    this._entries.unshift(suite);
  }
  allTests() {
    const result = [];
    const visit = suite => {
      for (const entry of suite._entries) {
        if (entry instanceof Suite) visit(entry);else result.push(entry);
      }
    };
    visit(this);
    return result;
  }
  _hasTests() {
    let result = false;
    const visit = suite => {
      for (const entry of suite._entries) {
        if (result) return;
        if (entry instanceof Suite) visit(entry);else result = true;
      }
    };
    visit(this);
    return result;
  }
  titlePath() {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    // Ignore anonymous describe blocks.
    if (this.title || this._type !== 'describe') titlePath.push(this.title);
    return titlePath;
  }
  _collectGrepTitlePath(path) {
    if (this.parent) this.parent._collectGrepTitlePath(path);
    if (this.title || this._type !== 'describe') path.push(this.title);
    path.push(...this._tags);
  }
  _getOnlyItems() {
    const items = [];
    if (this._only) items.push(this);
    for (const suite of this.suites) items.push(...suite._getOnlyItems());
    items.push(...this.tests.filter(test => test._only));
    return items;
  }
  _deepClone() {
    const suite = this._clone();
    for (const entry of this._entries) {
      if (entry instanceof Suite) suite._addSuite(entry._deepClone());else suite._addTest(entry._clone());
    }
    return suite;
  }
  _deepSerialize() {
    const suite = this._serialize();
    suite.entries = [];
    for (const entry of this._entries) {
      if (entry instanceof Suite) suite.entries.push(entry._deepSerialize());else suite.entries.push(entry._serialize());
    }
    return suite;
  }
  static _deepParse(data) {
    const suite = Suite._parse(data);
    for (const entry of data.entries) {
      if (entry.kind === 'suite') suite._addSuite(Suite._deepParse(entry));else suite._addTest(TestCase._parse(entry));
    }
    return suite;
  }
  forEachTest(visitor) {
    for (const entry of this._entries) {
      if (entry instanceof Suite) entry.forEachTest(visitor);else visitor(entry, this);
    }
  }
  _serialize() {
    return {
      kind: 'suite',
      title: this.title,
      type: this._type,
      location: this.location,
      only: this._only,
      requireFile: this._requireFile,
      timeout: this._timeout,
      retries: this._retries,
      staticAnnotations: this._staticAnnotations.slice(),
      tags: this._tags.slice(),
      modifiers: this._modifiers.slice(),
      parallelMode: this._parallelMode,
      hooks: this._hooks.map(h => ({
        type: h.type,
        location: h.location,
        title: h.title
      })),
      fileId: this._fileId
    };
  }
  static _parse(data) {
    const suite = new Suite(data.title, data.type);
    suite.location = data.location;
    suite._only = data.only;
    suite._requireFile = data.requireFile;
    suite._timeout = data.timeout;
    suite._retries = data.retries;
    suite._staticAnnotations = data.staticAnnotations;
    suite._tags = data.tags;
    suite._modifiers = data.modifiers;
    suite._parallelMode = data.parallelMode;
    suite._hooks = data.hooks.map(h => ({
      type: h.type,
      location: h.location,
      title: h.title,
      fn: () => {}
    }));
    suite._fileId = data.fileId;
    return suite;
  }
  _clone() {
    const data = this._serialize();
    const suite = Suite._parse(data);
    suite._use = this._use.slice();
    suite._hooks = this._hooks.slice();
    suite._fullProject = this._fullProject;
    return suite;
  }
  project() {
    var _this$_fullProject, _this$parent;
    return ((_this$_fullProject = this._fullProject) === null || _this$_fullProject === void 0 ? void 0 : _this$_fullProject.project) || ((_this$parent = this.parent) === null || _this$parent === void 0 ? void 0 : _this$parent.project());
  }
}
exports.Suite = Suite;
class TestCase extends Base {
  constructor(title, fn, testType, location) {
    super(title);
    this.fn = void 0;
    this.results = [];
    this.location = void 0;
    this.parent = void 0;
    this.type = 'test';
    this.expectedStatus = 'passed';
    this.timeout = 0;
    this.annotations = [];
    this.retries = 0;
    this.repeatEachIndex = 0;
    this._testType = void 0;
    this.id = '';
    this._pool = void 0;
    this._poolDigest = '';
    this._workerHash = '';
    this._projectId = '';
    // Annotations known statically before running the test, e.g. `test.skip()` or `test(title, { annotation }, body)`.
    this._staticAnnotations = [];
    // Explicitly declared tags that are not a part of the title.
    this._tags = [];
    this.fn = fn;
    this._testType = testType;
    this.location = location;
  }
  titlePath() {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    titlePath.push(this.title);
    return titlePath;
  }
  outcome() {
    return (0, _teleReceiver.computeTestCaseOutcome)(this);
  }
  ok() {
    const status = this.outcome();
    return status === 'expected' || status === 'flaky' || status === 'skipped';
  }
  get tags() {
    return this._grepTitle().match(/@[\S]+/g) || [];
  }
  _serialize() {
    return {
      kind: 'test',
      id: this.id,
      title: this.title,
      retries: this.retries,
      timeout: this.timeout,
      expectedStatus: this.expectedStatus,
      location: this.location,
      only: this._only,
      requireFile: this._requireFile,
      poolDigest: this._poolDigest,
      workerHash: this._workerHash,
      staticAnnotations: this._staticAnnotations.slice(),
      annotations: this.annotations.slice(),
      tags: this._tags.slice(),
      projectId: this._projectId
    };
  }
  static _parse(data) {
    const test = new TestCase(data.title, () => {}, _testType.rootTestType, data.location);
    test.id = data.id;
    test.retries = data.retries;
    test.timeout = data.timeout;
    test.expectedStatus = data.expectedStatus;
    test._only = data.only;
    test._requireFile = data.requireFile;
    test._poolDigest = data.poolDigest;
    test._workerHash = data.workerHash;
    test._staticAnnotations = data.staticAnnotations;
    test.annotations = data.annotations;
    test._tags = data.tags;
    test._projectId = data.projectId;
    return test;
  }
  _clone() {
    const data = this._serialize();
    const test = TestCase._parse(data);
    test._testType = this._testType;
    test.fn = this.fn;
    return test;
  }
  _appendTestResult() {
    const result = {
      retry: this.results.length,
      parallelIndex: -1,
      workerIndex: -1,
      duration: 0,
      startTime: new Date(),
      stdout: [],
      stderr: [],
      attachments: [],
      status: 'skipped',
      steps: [],
      errors: []
    };
    this.results.push(result);
    return result;
  }
  _grepTitle() {
    const path = [];
    this.parent._collectGrepTitlePath(path);
    path.push(this.title);
    path.push(...this._tags);
    return path.join(' ');
  }
}
exports.TestCase = TestCase;