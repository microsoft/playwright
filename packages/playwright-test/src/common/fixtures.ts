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

import { formatLocation, debugTest } from '../util';
import * as crypto from 'crypto';
import type { FixturesWithLocation, Location, WorkerInfo } from './types';
import { ManualPromise } from 'playwright-core/lib/utils';
import type { TestInfoImpl } from './testInfo';
import type { FixtureDescription, TimeoutManager } from './timeoutManager';

type FixtureScope = 'test' | 'worker';
type FixtureAuto = boolean | 'all-hooks-included';
const kScopeOrder: FixtureScope[] = ['test', 'worker'];
type FixtureOptions = { auto?: FixtureAuto, scope?: FixtureScope, option?: boolean, timeout?: number | undefined };
type FixtureTuple = [ value: any, options: FixtureOptions ];
type FixtureRegistration = {
  // Fixture registration location.
  location: Location;
  // Fixture name comes from test.extend() call.
  name: string;
  scope: FixtureScope;
  // Either a fixture function, or a fixture value.
  fn: Function | any;
  // Auto fixtures always run without user explicitly mentioning them.
  auto: FixtureAuto;
  // An "option" fixture can have a value set in the config.
  option: boolean;
  // Custom title to be used instead of the name, internal-only.
  customTitle?: string;
  // Fixture with a separate timeout does not count towards the test time.
  timeout?: number;
  // Names of the dependencies, comes from the declaration "({ foo, bar }) => {...}"
  deps: string[];
  // Unique id, to differentiate between fixtures with the same name.
  id: string;
  // A fixture override can use the previous version of the fixture.
  super?: FixtureRegistration;
  // Whether this fixture is an option value set from the config.
  fromConfig?: boolean;
};
export type LoadError = {
  message: string;
  location: Location;
};

class Fixture {
  runner: FixtureRunner;
  registration: FixtureRegistration;
  value: any;
  failed = false;

  _useFuncFinished: ManualPromise<void> | undefined;
  _selfTeardownComplete: Promise<void> | undefined;
  _teardownWithDepsComplete: Promise<void> | undefined;
  _runnableDescription: FixtureDescription;
  _deps = new Set<Fixture>();
  _usages = new Set<Fixture>();

  constructor(runner: FixtureRunner, registration: FixtureRegistration) {
    this.runner = runner;
    this.registration = registration;
    this.value = null;
    const title = this.registration.customTitle || this.registration.name;
    this._runnableDescription = {
      title: this.registration.timeout !== undefined ? `Fixture "${title}"` : `setting up "${title}"`,
      location: registration.location,
      slot: this.registration.timeout === undefined ? undefined : {
        timeout: this.registration.timeout,
        elapsed: 0,
      }
    };
  }

  async setup(testInfo: TestInfoImpl) {
    if (typeof this.registration.fn !== 'function') {
      this.value = this.registration.fn;
      return;
    }

    const params: { [key: string]: any } = {};
    for (const name of this.registration.deps) {
      const registration = this.runner.pool!.resolveDependency(this.registration, name)!;
      const dep = await this.runner.setupFixtureForRegistration(registration, testInfo);
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
    testInfo._timeoutManager.setCurrentFixture(this._runnableDescription);
    this._selfTeardownComplete = Promise.resolve().then(() => this.registration.fn(params, useFunc, info)).catch((e: any) => {
      this.failed = true;
      if (!useFuncStarted.isDone())
        useFuncStarted.reject(e);
      else
        throw e;
    });
    await useFuncStarted;
    testInfo._timeoutManager.setCurrentFixture(undefined);
  }

  async teardown(timeoutManager: TimeoutManager) {
    if (this._teardownWithDepsComplete) {
      // When we are waiting for the teardown for the second time,
      // most likely after the first time did timeout, annotate current fixture
      // for better error messages.
      this._setTeardownDescription(timeoutManager);
      await this._teardownWithDepsComplete;
      timeoutManager.setCurrentFixture(undefined);
      return;
    }
    this._teardownWithDepsComplete = this._teardownInternal(timeoutManager);
    await this._teardownWithDepsComplete;
  }

  private _setTeardownDescription(timeoutManager: TimeoutManager) {
    const title = this.registration.customTitle || this.registration.name;
    this._runnableDescription.title = this.registration.timeout !== undefined ? `Fixture "${title}"` : `tearing down "${title}"`;
    timeoutManager.setCurrentFixture(this._runnableDescription);
  }

  private async _teardownInternal(timeoutManager: TimeoutManager) {
    if (typeof this.registration.fn !== 'function')
      return;
    try {
      for (const fixture of this._usages)
        await fixture.teardown(timeoutManager);
      if (this._usages.size !== 0) {
        // TODO: replace with assert.
        console.error('Internal error: fixture integrity at', this._runnableDescription.title);  // eslint-disable-line no-console
        this._usages.clear();
      }
      if (this._useFuncFinished) {
        debugTest(`teardown ${this.registration.name}`);
        this._setTeardownDescription(timeoutManager);
        this._useFuncFinished.resolve();
        await this._selfTeardownComplete;
        timeoutManager.setCurrentFixture(undefined);
      }
    } finally {
      for (const dep of this._deps)
        dep._usages.delete(this);
      this.runner.instanceForId.delete(this.registration.id);
    }
  }
}

function isFixtureTuple(value: any): value is FixtureTuple {
  return Array.isArray(value) && typeof value[1] === 'object' && ('scope' in value[1] || 'auto' in value[1] || 'option' in value[1] || 'timeout' in value[1]);
}

export function isFixtureOption(value: any): value is FixtureTuple {
  return isFixtureTuple(value) && !!value[1].option;
}

export class FixturePool {
  readonly digest: string;
  readonly registrations: Map<string, FixtureRegistration>;
  private _onLoadError: (error: LoadError) => void;

  constructor(fixturesList: FixturesWithLocation[], onLoadError: (error: LoadError) => void, parentPool?: FixturePool, disallowWorkerFixtures?: boolean) {
    this.registrations = new Map(parentPool ? parentPool.registrations : []);
    this._onLoadError = onLoadError;

    for (const { fixtures, location, fromConfig } of fixturesList) {
      for (const entry of Object.entries(fixtures)) {
        const name = entry[0];
        let value = entry[1];
        let options: { auto: FixtureAuto, scope: FixtureScope, option: boolean, timeout: number | undefined, customTitle: string | undefined } | undefined;
        if (isFixtureTuple(value)) {
          options = {
            auto: value[1].auto ?? false,
            scope: value[1].scope || 'test',
            option: !!value[1].option,
            timeout: value[1].timeout,
            customTitle: (value[1] as any)._title,
          };
          value = value[0];
        }
        let fn = value as (Function | any);

        const previous = this.registrations.get(name);
        if (previous && options) {
          if (previous.scope !== options.scope) {
            this._addLoadError(`Fixture "${name}" has already been registered as a { scope: '${previous.scope}' } fixture defined in ${formatLocation(previous.location)}.`, location);
            continue;
          }
          if (previous.auto !== options.auto) {
            this._addLoadError(`Fixture "${name}" has already been registered as a { auto: '${previous.scope}' } fixture defined in ${formatLocation(previous.location)}.`, location);
            continue;
          }
        } else if (previous) {
          options = { auto: previous.auto, scope: previous.scope, option: previous.option, timeout: previous.timeout, customTitle: previous.customTitle };
        } else if (!options) {
          options = { auto: false, scope: 'test', option: false, timeout: undefined, customTitle: undefined };
        }

        if (!kScopeOrder.includes(options.scope)) {
          this._addLoadError(`Fixture "${name}" has unknown { scope: '${options.scope}' }.`, location);
          continue;
        }
        if (options.scope === 'worker' && disallowWorkerFixtures) {
          this._addLoadError(`Cannot use({ ${name} }) in a describe group, because it forces a new worker.\nMake it top-level in the test file or put in the configuration file.`, location);
          continue;
        }

        // Overriding option with "undefined" value means setting it to the default value
        // from the config or from the original declaration of the option.
        if (fn === undefined && options.option && previous) {
          let original = previous;
          while (!original.fromConfig && original.super)
            original = original.super;
          fn = original.fn;
        }

        const deps = fixtureParameterNames(fn, location, e => this._onLoadError(e));
        const registration: FixtureRegistration = { id: '', name, location, scope: options.scope, fn, auto: options.auto, option: options.option, timeout: options.timeout, customTitle: options.customTitle, deps, super: previous, fromConfig };
        registrationId(registration);
        this.registrations.set(name, registration);
      }
    }

    this.digest = this.validate();
  }

  private validate() {
    const markers = new Map<FixtureRegistration, 'visiting' | 'visited'>();
    const stack: FixtureRegistration[] = [];
    const visit = (registration: FixtureRegistration) => {
      markers.set(registration, 'visiting');
      stack.push(registration);
      for (const name of registration.deps) {
        const dep = this.resolveDependency(registration, name);
        if (!dep) {
          if (name === registration.name)
            this._addLoadError(`Fixture "${registration.name}" references itself, but does not have a base implementation.`, registration.location);
          else
            this._addLoadError(`Fixture "${registration.name}" has unknown parameter "${name}".`, registration.location);
          continue;
        }
        if (kScopeOrder.indexOf(registration.scope) > kScopeOrder.indexOf(dep.scope)) {
          this._addLoadError(`${registration.scope} fixture "${registration.name}" cannot depend on a ${dep.scope} fixture "${name}" defined in ${formatLocation(dep.location)}.`, registration.location);
          continue;
        }
        if (!markers.has(dep)) {
          visit(dep);
        } else if (markers.get(dep) === 'visiting') {
          const index = stack.indexOf(dep);
          const regs = stack.slice(index, stack.length);
          const names = regs.map(r => `"${r.name}"`);
          this._addLoadError(`Fixtures ${names.join(' -> ')} -> "${dep.name}" form a dependency cycle: ${regs.map(r => formatLocation(r.location)).join(' -> ')}`, dep.location);
          continue;
        }
      }
      markers.set(registration, 'visited');
      stack.pop();
    };

    const hash = crypto.createHash('sha1');
    const names = Array.from(this.registrations.keys()).sort();
    for (const name of names) {
      const registration = this.registrations.get(name)!;
      visit(registration);
      if (registration.scope === 'worker')
        hash.update(registration.id + ';');
    }
    return hash.digest('hex');
  }

  validateFunction(fn: Function, prefix: string, location: Location) {
    for (const name of fixtureParameterNames(fn, location, e => this._onLoadError(e))) {
      const registration = this.registrations.get(name);
      if (!registration)
        this._addLoadError(`${prefix} has unknown parameter "${name}".`, location);
    }
  }

  resolveDependency(registration: FixtureRegistration, name: string): FixtureRegistration | undefined {
    if (name === registration.name)
      return registration.super;
    return this.registrations.get(name);
  }

  private _addLoadError(message: string, location: Location) {
    this._onLoadError({ message, location });
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

  async teardownScope(scope: FixtureScope, timeoutManager: TimeoutManager) {
    let error: Error | undefined;
    // Teardown fixtures in the reverse order.
    const fixtures = Array.from(this.instanceForId.values()).reverse();
    for (const fixture of fixtures) {
      if (fixture.registration.scope === scope) {
        try {
          await fixture.teardown(timeoutManager);
        } catch (e) {
          if (error === undefined)
            error = e;
        }
      }
    }
    if (scope === 'test')
      this.testScopeClean = true;
    if (error !== undefined)
      throw error;
  }

  async resolveParametersForFunction(fn: Function, testInfo: TestInfoImpl, autoFixtures: 'worker' | 'test' | 'all-hooks-only'): Promise<object | null> {
    // Install automatic fixtures.
    for (const registration of this.pool!.registrations.values()) {
      if (registration.auto === false)
        continue;
      let shouldRun = true;
      if (autoFixtures === 'all-hooks-only')
        shouldRun = registration.scope === 'worker' || registration.auto === 'all-hooks-included';
      else if (autoFixtures === 'worker')
        shouldRun = registration.scope === 'worker';
      if (shouldRun) {
        const fixture = await this.setupFixtureForRegistration(registration, testInfo);
        if (fixture.failed)
          return null;
      }
    }

    // Install used fixtures.
    const names = fixtureParameterNames(fn, { file: '<unused>', line: 1, column: 1 }, serializeAndThrowError);
    const params: { [key: string]: any } = {};
    for (const name of names) {
      const registration = this.pool!.registrations.get(name)!;
      const fixture = await this.setupFixtureForRegistration(registration, testInfo);
      if (fixture.failed)
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

  async setupFixtureForRegistration(registration: FixtureRegistration, testInfo: TestInfoImpl): Promise<Fixture> {
    if (registration.scope === 'test')
      this.testScopeClean = false;

    let fixture = this.instanceForId.get(registration.id);
    if (fixture)
      return fixture;

    fixture = new Fixture(this, registration);
    this.instanceForId.set(registration.id, fixture);
    await fixture.setup(testInfo);
    return fixture;
  }

  dependsOnWorkerFixturesOnly(fn: Function, location: Location): boolean {
    const names = fixtureParameterNames(fn, location, serializeAndThrowError);
    for (const name of names) {
      const registration = this.pool!.registrations.get(name)!;
      if (registration.scope !== 'worker')
        return false;
    }
    return true;
  }
}

function serializeAndThrowError(e: LoadError) {
  throw new Error(`${formatLocation(e.location!)}: ${e.message}`);
}

const signatureSymbol = Symbol('signature');

function fixtureParameterNames(fn: Function | any, location: Location, onError: (error: LoadError) => void): string[] {
  if (typeof fn !== 'function')
    return [];
  if (!fn[signatureSymbol])
    fn[signatureSymbol] = innerFixtureParameterNames(fn, location, onError);
  return fn[signatureSymbol];
}

function innerFixtureParameterNames(fn: Function, location: Location, onError: (error: LoadError) => void): string[] {
  const text = fn.toString();
  const match = text.match(/(?:async)?(?:\s+function)?[^(]*\(([^)]*)/);
  if (!match)
    return [];
  const trimmedParams = match[1].trim();
  if (!trimmedParams)
    return [];
  const [firstParam] = splitByComma(trimmedParams);
  if (firstParam[0] !== '{' || firstParam[firstParam.length - 1] !== '}')
    onError({ message: 'First argument must use the object destructuring pattern: '  + firstParam, location });
  const props = splitByComma(firstParam.substring(1, firstParam.length - 1)).map(prop => {
    const colon = prop.indexOf(':');
    return colon === -1 ? prop : prop.substring(0, colon).trim();
  });
  return props;
}

function splitByComma(s: string) {
  const result: string[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']');
    } else if (s[i] === stack[stack.length - 1]) {
      stack.pop();
    } else if (!stack.length && s[i] === ',') {
      const token = s.substring(start, i).trim();
      if (token)
        result.push(token);
      start = i + 1;
    }
  }
  const lastToken = s.substring(start).trim();
  if (lastToken)
    result.push(lastToken);
  return result;
}

// name + superId, fn -> id
const registrationIdMap = new Map<string, Map<Function | any, string>>();
let lastId = 0;

function registrationId(registration: FixtureRegistration): string {
  if (registration.id)
    return registration.id;
  const key = registration.name + '@@@' + (registration.super ?  registrationId(registration.super) : '');
  let map = registrationIdMap.get(key);
  if (!map) {
    map = new Map();
    registrationIdMap.set(key, map);
  }
  if (!map.has(registration.fn))
    map.set(registration.fn, String(lastId++));
  registration.id = map.get(registration.fn)!;
  return registration.id;
}
