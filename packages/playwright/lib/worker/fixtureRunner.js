"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FixtureRunner = void 0;
var _util = require("../util");
var _utils = require("playwright-core/lib/utils");
var _timeoutManager = require("./timeoutManager");
var _fixtures = require("../common/fixtures");
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

class Fixture {
  constructor(runner, registration) {
    this.runner = void 0;
    this.registration = void 0;
    this.value = void 0;
    this.failed = false;
    this._useFuncFinished = void 0;
    this._selfTeardownComplete = void 0;
    this._setupDescription = void 0;
    this._teardownDescription = void 0;
    this._stepInfo = void 0;
    this._deps = new Set();
    this._usages = new Set();
    this.runner = runner;
    this.registration = registration;
    this.value = null;
    const shouldGenerateStep = !this.registration.hideStep && !this.registration.name.startsWith('_') && !this.registration.option;
    const isInternalFixture = this.registration.location && (0, _util.filterStackFile)(this.registration.location.file);
    const title = this.registration.customTitle || this.registration.name;
    const location = isInternalFixture ? this.registration.location : undefined;
    this._stepInfo = shouldGenerateStep ? {
      category: 'fixture',
      location
    } : undefined;
    this._setupDescription = {
      title,
      phase: 'setup',
      location,
      slot: this.registration.timeout === undefined ? undefined : {
        timeout: this.registration.timeout,
        elapsed: 0
      }
    };
    this._teardownDescription = {
      ...this._setupDescription,
      phase: 'teardown'
    };
  }
  async setup(testInfo, runnable) {
    this.runner.instanceForId.set(this.registration.id, this);
    if (typeof this.registration.fn !== 'function') {
      this.value = this.registration.fn;
      return;
    }
    await testInfo._runAsStage({
      title: `fixture: ${this.registration.name}`,
      runnable: {
        ...runnable,
        fixture: this._setupDescription
      },
      stepInfo: this._stepInfo
    }, async () => {
      await this._setupInternal(testInfo);
    });
  }
  async _setupInternal(testInfo) {
    const params = {};
    for (const name of this.registration.deps) {
      const registration = this.runner.pool.resolve(name, this.registration);
      const dep = this.runner.instanceForId.get(registration.id);
      if (!dep) {
        this.failed = true;
        return;
      }
      // Fixture teardown is root => leaves, when we need to teardown a fixture,
      // it recursively tears down its usages first.
      dep._usages.add(this);
      // Don't forget to decrement all usages when fixture goes.
      // Otherwise worker-scope fixtures will retain test-scope fixtures forever.
      this._deps.add(dep);
      params[name] = dep.value;
      if (dep.failed) {
        this.failed = true;
        return;
      }
    }
    let called = false;
    const useFuncStarted = new _utils.ManualPromise();
    const useFunc = async value => {
      if (called) throw new Error(`Cannot provide fixture value for the second time`);
      called = true;
      this.value = value;
      this._useFuncFinished = new _utils.ManualPromise();
      useFuncStarted.resolve();
      await this._useFuncFinished;
    };
    const workerInfo = {
      config: testInfo.config,
      parallelIndex: testInfo.parallelIndex,
      workerIndex: testInfo.workerIndex,
      project: testInfo.project
    };
    const info = this.registration.scope === 'worker' ? workerInfo : testInfo;
    this._selfTeardownComplete = (async () => {
      try {
        await this.registration.fn(params, useFunc, info);
      } catch (error) {
        this.failed = true;
        if (!useFuncStarted.isDone()) useFuncStarted.reject(error);else throw error;
      }
    })();
    await useFuncStarted;
  }
  async teardown(testInfo, runnable) {
    await testInfo._runAsStage({
      title: `fixture: ${this.registration.name}`,
      runnable: {
        ...runnable,
        fixture: this._teardownDescription
      },
      stepInfo: this._stepInfo
    }, async () => {
      await this._teardownInternal();
    });
  }
  async _teardownInternal() {
    if (typeof this.registration.fn !== 'function') return;
    try {
      if (this._usages.size !== 0) {
        // TODO: replace with assert.
        console.error('Internal error: fixture integrity at', this._teardownDescription.title); // eslint-disable-line no-console
        this._usages.clear();
      }
      if (this._useFuncFinished) {
        this._useFuncFinished.resolve();
        this._useFuncFinished = undefined;
        await this._selfTeardownComplete;
      }
    } finally {
      this._cleanupInstance();
    }
  }
  _cleanupInstance() {
    for (const dep of this._deps) dep._usages.delete(this);
    this.runner.instanceForId.delete(this.registration.id);
  }
  _collectFixturesInTeardownOrder(scope, collector) {
    if (this.registration.scope !== scope) return;
    for (const fixture of this._usages) fixture._collectFixturesInTeardownOrder(scope, collector);
    collector.add(this);
  }
}
class FixtureRunner {
  constructor() {
    this.testScopeClean = true;
    this.pool = void 0;
    this.instanceForId = new Map();
  }
  setPool(pool) {
    if (!this.testScopeClean) throw new Error('Did not teardown test scope');
    if (this.pool && pool.digest !== this.pool.digest) {
      throw new Error([`Playwright detected inconsistent test.use() options.`, `Most common mistakes that lead to this issue:`, `  - Calling test.use() outside of the test file, for example in a common helper.`, `  - One test file imports from another test file.`].join('\n'));
    }
    this.pool = pool;
  }
  _collectFixturesInSetupOrder(registration, collector) {
    if (collector.has(registration)) return;
    for (const name of registration.deps) {
      const dep = this.pool.resolve(name, registration);
      this._collectFixturesInSetupOrder(dep, collector);
    }
    collector.add(registration);
  }
  async teardownScope(scope, testInfo, runnable) {
    // Teardown fixtures in the reverse order.
    const fixtures = Array.from(this.instanceForId.values()).reverse();
    const collector = new Set();
    for (const fixture of fixtures) fixture._collectFixturesInTeardownOrder(scope, collector);
    try {
      let firstError;
      for (const fixture of collector) {
        try {
          await fixture.teardown(testInfo, runnable);
        } catch (error) {
          var _firstError;
          if (error instanceof _timeoutManager.TimeoutManagerError) throw error;
          firstError = (_firstError = firstError) !== null && _firstError !== void 0 ? _firstError : error;
        }
      }
      if (firstError) throw firstError;
    } finally {
      // To preserve fixtures integrity, forcefully cleanup fixtures that did not teardown
      // due to a timeout in one of them.
      for (const fixture of collector) fixture._cleanupInstance();
      if (scope === 'test') this.testScopeClean = true;
    }
  }
  async resolveParametersForFunction(fn, testInfo, autoFixtures, runnable) {
    const collector = new Set();

    // Collect automatic fixtures.
    const auto = [];
    for (const registration of this.pool.autoFixtures()) {
      let shouldRun = true;
      if (autoFixtures === 'all-hooks-only') shouldRun = registration.scope === 'worker' || registration.auto === 'all-hooks-included';else if (autoFixtures === 'worker') shouldRun = registration.scope === 'worker';
      if (shouldRun) auto.push(registration);
    }
    auto.sort((r1, r2) => (r1.scope === 'worker' ? 0 : 1) - (r2.scope === 'worker' ? 0 : 1));
    for (const registration of auto) this._collectFixturesInSetupOrder(registration, collector);

    // Collect used fixtures.
    const names = getRequiredFixtureNames(fn);
    for (const name of names) this._collectFixturesInSetupOrder(this.pool.resolve(name), collector);

    // Setup fixtures.
    for (const registration of collector) await this._setupFixtureForRegistration(registration, testInfo, runnable);

    // Create params object.
    const params = {};
    for (const name of names) {
      const registration = this.pool.resolve(name);
      const fixture = this.instanceForId.get(registration.id);
      if (!fixture || fixture.failed) return null;
      params[name] = fixture.value;
    }
    return params;
  }
  async resolveParametersAndRunFunction(fn, testInfo, autoFixtures, runnable) {
    const params = await this.resolveParametersForFunction(fn, testInfo, autoFixtures, runnable);
    if (params === null) {
      // Do not run the function when fixture setup has already failed.
      return null;
    }
    await testInfo._runAsStage({
      title: 'run function',
      runnable
    }, async () => {
      await fn(params, testInfo);
    });
  }
  async _setupFixtureForRegistration(registration, testInfo, runnable) {
    if (registration.scope === 'test') this.testScopeClean = false;
    let fixture = this.instanceForId.get(registration.id);
    if (fixture) return fixture;
    fixture = new Fixture(this, registration);
    await fixture.setup(testInfo, runnable);
    return fixture;
  }
  dependsOnWorkerFixturesOnly(fn, location) {
    const names = getRequiredFixtureNames(fn, location);
    for (const name of names) {
      const registration = this.pool.resolve(name);
      if (registration.scope !== 'worker') return false;
    }
    return true;
  }
}
exports.FixtureRunner = FixtureRunner;
function getRequiredFixtureNames(fn, location) {
  return (0, _fixtures.fixtureParameterNames)(fn, location !== null && location !== void 0 ? location : {
    file: '<unknown>',
    line: 1,
    column: 1
  }, e => {
    throw new Error(`${(0, _util.formatLocation)(e.location)}: ${e.message}`);
  });
}