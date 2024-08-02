"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PoolBuilder = void 0;
var _fixtures = require("./fixtures");
var _util = require("../util");
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

class PoolBuilder {
  static createForLoader() {
    return new PoolBuilder('loader');
  }
  static createForWorker(project) {
    return new PoolBuilder('worker', project);
  }
  constructor(type, project) {
    this._project = void 0;
    this._testTypePools = new Map();
    this._type = void 0;
    this._type = type;
    this._project = project;
  }
  buildPools(suite, testErrors) {
    suite.forEachTest(test => {
      const pool = this._buildPoolForTest(test, testErrors);
      if (this._type === 'loader') test._poolDigest = pool.digest;
      if (this._type === 'worker') test._pool = pool;
    });
  }
  _buildPoolForTest(test, testErrors) {
    let pool = this._buildTestTypePool(test._testType, testErrors);
    const parents = [];
    for (let parent = test.parent; parent; parent = parent.parent) parents.push(parent);
    parents.reverse();
    for (const parent of parents) {
      if (parent._use.length) pool = new _fixtures.FixturePool(parent._use, e => this._handleLoadError(e, testErrors), pool, parent._type === 'describe');
      for (const hook of parent._hooks) pool.validateFunction(hook.fn, hook.type + ' hook', hook.location);
      for (const modifier of parent._modifiers) pool.validateFunction(modifier.fn, modifier.type + ' modifier', modifier.location);
    }
    pool.validateFunction(test.fn, 'Test', test.location);
    return pool;
  }
  _buildTestTypePool(testType, testErrors) {
    if (!this._testTypePools.has(testType)) {
      var _this$_project$projec, _this$_project, _this$_project2;
      const optionOverrides = {
        overrides: (_this$_project$projec = (_this$_project = this._project) === null || _this$_project === void 0 || (_this$_project = _this$_project.project) === null || _this$_project === void 0 ? void 0 : _this$_project.use) !== null && _this$_project$projec !== void 0 ? _this$_project$projec : {},
        location: {
          file: `project#${(_this$_project2 = this._project) === null || _this$_project2 === void 0 ? void 0 : _this$_project2.id}`,
          line: 1,
          column: 1
        }
      };
      const pool = new _fixtures.FixturePool(testType.fixtures, e => this._handleLoadError(e, testErrors), undefined, undefined, optionOverrides);
      this._testTypePools.set(testType, pool);
    }
    return this._testTypePools.get(testType);
  }
  _handleLoadError(e, testErrors) {
    if (testErrors) testErrors.push(e);else throw new Error(`${(0, _util.formatLocation)(e.location)}: ${e.message}`);
  }
}
exports.PoolBuilder = PoolBuilder;