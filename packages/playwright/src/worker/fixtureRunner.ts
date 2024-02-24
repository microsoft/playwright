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

import { formatLocation, debugTest, filterStackFile } from '../util';
import { ManualPromise } from 'playwright-core/lib/utils';
import type { TestInfoImpl } from './testInfo';
import type { FixtureDescription } from './timeoutManager';
import { fixtureParameterNames, type FixturePool, type FixtureRegistration, type FixtureScope } from '../common/fixtures';
import type { WorkerInfo } from '../../types/test';
import type { Location } from '../../types/testReporter';

class Fixture {
  runner: FixtureRunner;
  registration: FixtureRegistration;
  value: any;
  failed = false;

  private _useFuncFinished: ManualPromise<void> | undefined;
  private _selfTeardownComplete: Promise<void> | undefined;
  private _teardownWithDepsComplete: Promise<void> | undefined;
  private _setupDescription: FixtureDescription;
  private _teardownDescription: FixtureDescription;
  private _shouldGenerateStep = false;
  private _isInternalFixture = false;
  _deps = new Set<Fixture>();
  _usages = new Set<Fixture>();

  constructor(runner: FixtureRunner, registration: FixtureRegistration) {
    this.runner = runner;
    this.registration = registration;
    this.value = null;
    const title = this.registration.customTitle || this.registration.name;
    this._setupDescription = {
      title,
      phase: 'setup',
      location: registration.location,
      slot: this.registration.timeout === undefined ? undefined : {
        timeout: this.registration.timeout,
        elapsed: 0,
      }
    };
    this._teardownDescription = { ...this._setupDescription, phase: 'teardown' };
    this._shouldGenerateStep = !this.registration.hideStep && !this.registration.name.startsWith('_') && !this.registration.option;
    this._isInternalFixture = this.registration.location && filterStackFile(this.registration.location.file);
  }

  async setup(testInfo: TestInfoImpl) {
    this.runner.instanceForId.set(this.registration.id, this);

    if (typeof this.registration.fn !== 'function') {
      this.value = this.registration.fn;
      return;
    }

    testInfo._timeoutManager.setCurrentFixture(this._setupDescription);
    const beforeStep = this._shouldGenerateStep ? testInfo._addStep({
      title: `fixture: ${this.registration.name}`,
      category: 'fixture',
      location: this._isInternalFixture ? this.registration.location : undefined,
      wallTime: Date.now(),
    }) : undefined;
    try {
      await this._setupInternal(testInfo);
      beforeStep?.complete({});
    } catch (error) {
      beforeStep?.complete({ error });
      throw error;
    } finally {
      testInfo._timeoutManager.setCurrentFixture(undefined);
    }
  }

  private async _setupInternal(testInfo: TestInfoImpl) {
    const params: { [key: string]: any } = {};
    for (const name of this.registration.deps) {
      const registration = this.runner.pool!.resolve(name, this.registration)!;
      const dep = this.runner.instanceForId.get(registration.id);
      if (!dep) {
        this.failed = true;
        return;
      }
      // Fixture teardown is root => leafs, when we need to teardown a fixture,
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
    const useFuncStarted = new ManualPromise<void>();
    debugTest(`setup ${this.registration.name}`);
    const useFunc = async (value: any) => {
      if (called)
        throw new Error(`Cannot provide fixture value for the second time`);
      called = true;
      this.value = value;
      this._useFuncFinished = new ManualPromise<void>();
      useFuncStarted.resolve();
      await this._useFuncFinished;
    };

    const workerInfo: WorkerInfo = { config: testInfo.config, parallelIndex: testInfo.parallelIndex, workerIndex: testInfo.workerIndex, project: testInfo.project };
    const info = this.registration.scope === 'worker' ? workerInfo : testInfo;
    this._selfTeardownComplete = (async () => {
      try {
        await this.registration.fn(params, useFunc, info);
      } catch (error) {
        this.failed = true;
        if (!useFuncStarted.isDone())
          useFuncStarted.reject(error);
        else
          throw error;
      }
    })();
    await useFuncStarted;
  }

  async teardown(testInfo: TestInfoImpl) {
    const afterStep = this._shouldGenerateStep ? testInfo?._addStep({
      wallTime: Date.now(),
      title: `fixture: ${this.registration.name}`,
      category: 'fixture',
      location: this._isInternalFixture ? this.registration.location : undefined,
    }) : undefined;
    testInfo._timeoutManager.setCurrentFixture(this._teardownDescription);
    try {
      if (!this._teardownWithDepsComplete)
        this._teardownWithDepsComplete = this._teardownInternal();
      await this._teardownWithDepsComplete;
      afterStep?.complete({});
    } catch (error) {
      afterStep?.complete({ error });
      throw error;
    } finally {
      testInfo._timeoutManager.setCurrentFixture(undefined);
    }
  }

  private async _teardownInternal() {
    if (typeof this.registration.fn !== 'function')
      return;
    try {
      if (this._usages.size !== 0) {
        // TODO: replace with assert.
        console.error('Internal error: fixture integrity at', this._teardownDescription.title);  // eslint-disable-line no-console
        this._usages.clear();
      }
      if (this._useFuncFinished) {
        debugTest(`teardown ${this.registration.name}`);
        this._useFuncFinished.resolve();
        await this._selfTeardownComplete;
      }
    } finally {
      for (const dep of this._deps)
        dep._usages.delete(this);
      this.runner.instanceForId.delete(this.registration.id);
    }
  }

  _collectFixturesInTeardownOrder(scope: FixtureScope, collector: Set<Fixture>) {
    if (this.registration.scope !== scope)
      return;
    for (const fixture of this._usages)
      fixture._collectFixturesInTeardownOrder(scope, collector);
    collector.add(this);
  }
}

export class FixtureRunner {
  private testScopeClean = true;
  pool: FixturePool | undefined;
  instanceForId = new Map<string, Fixture>();

  setPool(pool: FixturePool) {
    if (!this.testScopeClean)
      throw new Error('Did not teardown test scope');
    if (this.pool && pool.digest !== this.pool.digest) {
      throw new Error([
        `Playwright detected inconsistent test.use() options.`,
        `Most common mistakes that lead to this issue:`,
        `  - Calling test.use() outside of the test file, for example in a common helper.`,
        `  - One test file imports from another test file.`,
      ].join('\n'));
    }
    this.pool = pool;
  }

  private _collectFixturesInSetupOrder(registration: FixtureRegistration, collector: Set<FixtureRegistration>) {
    if (collector.has(registration))
      return;
    for (const name of registration.deps) {
      const dep = this.pool!.resolve(name, registration)!;
      this._collectFixturesInSetupOrder(dep, collector);
    }
    collector.add(registration);
  }

  async teardownScope(scope: FixtureScope, testInfo: TestInfoImpl, onFixtureError: (error: Error) => void) {
    // Teardown fixtures in the reverse order.
    const fixtures = Array.from(this.instanceForId.values()).reverse();
    const collector = new Set<Fixture>();
    for (const fixture of fixtures)
      fixture._collectFixturesInTeardownOrder(scope, collector);
    for (const fixture of collector)
      await fixture.teardown(testInfo).catch(onFixtureError);
    if (scope === 'test')
      this.testScopeClean = true;
  }

  async resolveParametersForFunction(fn: Function, testInfo: TestInfoImpl, autoFixtures: 'worker' | 'test' | 'all-hooks-only'): Promise<object | null> {
    const collector = new Set<FixtureRegistration>();

    // Collect automatic fixtures.
    const auto: FixtureRegistration[] = [];
    for (const registration of this.pool!.autoFixtures()) {
      let shouldRun = true;
      if (autoFixtures === 'all-hooks-only')
        shouldRun = registration.scope === 'worker' || registration.auto === 'all-hooks-included';
      else if (autoFixtures === 'worker')
        shouldRun = registration.scope === 'worker';
      if (shouldRun)
        auto.push(registration);
    }
    auto.sort((r1, r2) => (r1.scope === 'worker' ? 0 : 1) - (r2.scope === 'worker' ? 0 : 1));
    for (const registration of auto)
      this._collectFixturesInSetupOrder(registration, collector);

    // Collect used fixtures.
    const names = getRequiredFixtureNames(fn);
    for (const name of names)
      this._collectFixturesInSetupOrder(this.pool!.resolve(name)!, collector);

    // Setup fixtures.
    for (const registration of collector) {
      const fixture = await this._setupFixtureForRegistration(registration, testInfo);
      if (fixture.failed)
        return null;
    }

    // Create params object.
    const params: { [key: string]: any } = {};
    for (const name of names) {
      const registration = this.pool!.resolve(name)!;
      const fixture = this.instanceForId.get(registration.id)!;
      if (!fixture || fixture.failed)
        return null;
      params[name] = fixture.value;
    }
    return params;
  }

  async resolveParametersAndRunFunction(fn: Function, testInfo: TestInfoImpl, autoFixtures: 'worker' | 'test' | 'all-hooks-only') {
    const params = await this.resolveParametersForFunction(fn, testInfo, autoFixtures);
    if (params === null) {
      // Do not run the function when fixture setup has already failed.
      return null;
    }
    return fn(params, testInfo);
  }

  private async _setupFixtureForRegistration(registration: FixtureRegistration, testInfo: TestInfoImpl): Promise<Fixture> {
    if (registration.scope === 'test')
      this.testScopeClean = false;

    let fixture = this.instanceForId.get(registration.id);
    if (fixture)
      return fixture;

    fixture = new Fixture(this, registration);
    await fixture.setup(testInfo);
    return fixture;
  }

  dependsOnWorkerFixturesOnly(fn: Function, location: Location): boolean {
    const names = getRequiredFixtureNames(fn, location);
    for (const name of names) {
      const registration = this.pool!.resolve(name)!;
      if (registration.scope !== 'worker')
        return false;
    }
    return true;
  }
}

function getRequiredFixtureNames(fn: Function, location?: Location) {
  return fixtureParameterNames(fn, location ?? { file: '<unknown>', line: 1, column: 1 }, e => {
    throw new Error(`${formatLocation(e.location!)}: ${e.message}`);
  });
}
