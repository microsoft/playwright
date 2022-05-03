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

import { formatLocation, debugTest } from './util';
import * as crypto from 'crypto';
import type { FixturesWithLocation, Location, WorkerInfo } from './types';
import { ManualPromise } from 'playwright-core/lib/utils/manualPromise';
import type { TestInfoImpl } from './testInfo';
import type { FixtureDescription, TimeoutManager } from './timeoutManager';

type FixtureScope = 'test' | 'worker';
const kScopeOrder: FixtureScope[] = ['test', 'worker'];
type FixtureOptions = { auto?: boolean, scope?: FixtureScope, option?: boolean, timeout?: number | undefined };
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
  auto: boolean;
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
};

class Fixture {
  runner: FixtureRunner;
  registration: FixtureRegistration;
  usages: Set<Fixture>;
  value: any;

  _useFuncFinished: ManualPromise<void> | undefined;
  _selfTeardownComplete: Promise<void> | undefined;
  _teardownWithDepsComplete: Promise<void> | undefined;
  _runnableDescription: FixtureDescription;

  constructor(runner: FixtureRunner, registration: FixtureRegistration) {
    this.runner = runner;
    this.registration = registration;
    this.usages = new Set();
    this.value = null;
    this._runnableDescription = {
      title: `fixture "${this.registration.customTitle || this.registration.name}" setup`,
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
      dep.usages.add(this);
      params[name] = dep.value;
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
      if (!useFuncStarted.isDone())
        useFuncStarted.reject(e);
      else
        throw e;
    });
    await useFuncStarted;
    testInfo._timeoutManager.setCurrentFixture(undefined);
  }

  async teardown(timeoutManager: TimeoutManager) {
    if (!this._teardownWithDepsComplete)
      this._teardownWithDepsComplete = this._teardownInternal(timeoutManager);
    await this._teardownWithDepsComplete;
  }

  private async _teardownInternal(timeoutManager: TimeoutManager) {
    if (typeof this.registration.fn !== 'function')
      return;
    try {
      for (const fixture of this.usages)
        await fixture.teardown(timeoutManager);
      this.usages.clear();
      if (this._useFuncFinished) {
        debugTest(`teardown ${this.registration.name}`);
        this._runnableDescription.title = `fixture "${this.registration.customTitle || this.registration.name}" teardown`;
        timeoutManager.setCurrentFixture(this._runnableDescription);
        this._useFuncFinished.resolve();
        await this._selfTeardownComplete;
        timeoutManager.setCurrentFixture(undefined);
      }
    } finally {
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

  constructor(fixturesList: FixturesWithLocation[], parentPool?: FixturePool, disallowWorkerFixtures?: boolean) {
    this.registrations = new Map(parentPool ? parentPool.registrations : []);

    for (const { fixtures, location } of fixturesList) {
      for (const entry of Object.entries(fixtures)) {
        const name = entry[0];
        let value = entry[1];
        let options: { auto: boolean, scope: FixtureScope, option: boolean, timeout: number | undefined, customTitle: string | undefined } | undefined;
        if (isFixtureTuple(value)) {
          options = {
            auto: !!value[1].auto,
            scope: value[1].scope || 'test',
            option: !!value[1].option,
            timeout: value[1].timeout,
            customTitle: (value[1] as any)._title,
          };
          value = value[0];
        }
        const fn = value as (Function | any);

        const previous = this.registrations.get(name);
        if (previous && options) {
          if (previous.scope !== options.scope)
            throw errorWithLocations(`Fixture "${name}" has already been registered as a { scope: '${previous.scope}' } fixture.`, { location, name }, previous);
          if (previous.auto !== options.auto)
            throw errorWithLocations(`Fixture "${name}" has already been registered as a { auto: '${previous.scope}' } fixture.`, { location, name }, previous);
        } else if (previous) {
          options = { auto: previous.auto, scope: previous.scope, option: previous.option, timeout: previous.timeout, customTitle: previous.customTitle };
        } else if (!options) {
          options = { auto: false, scope: 'test', option: false, timeout: undefined, customTitle: undefined };
        }

        if (!kScopeOrder.includes(options.scope))
          throw errorWithLocations(`Fixture "${name}" has unknown { scope: '${options.scope}' }.`, { location, name });
        if (options.scope === 'worker' && disallowWorkerFixtures)
          throw errorWithLocations(`Cannot use({ ${name} }) in a describe group, because it forces a new worker.\nMake it top-level in the test file or put in the configuration file.`, { location, name });

        const deps = fixtureParameterNames(fn, location);
        const registration: FixtureRegistration = { id: '', name, location, scope: options.scope, fn, auto: options.auto, option: options.option, timeout: options.timeout, customTitle: options.customTitle, deps, super: previous };
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
            throw errorWithLocations(`Fixture "${registration.name}" references itself, but does not have a base implementation.`, registration);
          else
            throw errorWithLocations(`Fixture "${registration.name}" has unknown parameter "${name}".`, registration);
        }
        if (kScopeOrder.indexOf(registration.scope) > kScopeOrder.indexOf(dep.scope))
          throw errorWithLocations(`${registration.scope} fixture "${registration.name}" cannot depend on a ${dep.scope} fixture "${name}".`, registration, dep);
        if (!markers.has(dep)) {
          visit(dep);
        } else if (markers.get(dep) === 'visiting') {
          const index = stack.indexOf(dep);
          const regs = stack.slice(index, stack.length);
          const names = regs.map(r => `"${r.name}"`);
          throw errorWithLocations(`Fixtures ${names.join(' -> ')} -> "${dep.name}" form a dependency cycle.`, ...regs);
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
    const visit = (registration: FixtureRegistration) => {
      for (const name of registration.deps)
        visit(this.resolveDependency(registration, name)!);
    };
    for (const name of fixtureParameterNames(fn, location)) {
      const registration = this.registrations.get(name);
      if (!registration)
        throw errorWithLocations(`${prefix} has unknown parameter "${name}".`, { location, name: prefix, quoted: false });
      visit(registration);
    }
  }

  resolveDependency(registration: FixtureRegistration, name: string): FixtureRegistration | undefined {
    if (name === registration.name)
      return registration.super;
    return this.registrations.get(name);
  }
}

export class FixtureRunner {
  private testScopeClean = true;
  pool: FixturePool | undefined;
  instanceForId = new Map<string, Fixture>();

  setPool(pool: FixturePool) {
    if (!this.testScopeClean)
      throw new Error('Did not teardown test scope');
    if (this.pool && pool.digest !== this.pool.digest)
      throw new Error('Digests do not match');
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

  async resolveParametersForFunction(fn: Function, testInfo: TestInfoImpl): Promise<object> {
    // Install all automatic fixtures.
    for (const registration of this.pool!.registrations.values()) {
      const shouldSkip = !testInfo && registration.scope === 'test';
      if (registration.auto && !shouldSkip)
        await this.setupFixtureForRegistration(registration, testInfo);
    }

    // Install used fixtures.
    const names = fixtureParameterNames(fn, { file: '<unused>', line: 1, column: 1 });
    const params: { [key: string]: any } = {};
    for (const name of names) {
      const registration = this.pool!.registrations.get(name)!;
      const fixture = await this.setupFixtureForRegistration(registration, testInfo);
      params[name] = fixture.value;
    }
    return params;
  }

  async resolveParametersAndRunFunction(fn: Function, testInfo: TestInfoImpl) {
    const params = await this.resolveParametersForFunction(fn, testInfo);
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
    const names = fixtureParameterNames(fn, location);
    for (const name of names) {
      const registration = this.pool!.registrations.get(name)!;
      if (registration.scope !== 'worker')
        return false;
    }
    return true;
  }
}

const signatureSymbol = Symbol('signature');

function fixtureParameterNames(fn: Function | any, location: Location): string[] {
  if (typeof fn !== 'function')
    return [];
  if (!fn[signatureSymbol])
    fn[signatureSymbol] = innerFixtureParameterNames(fn, location);
  return fn[signatureSymbol];
}

function innerFixtureParameterNames(fn: Function, location: Location): string[] {
  const text = fn.toString();
  const match = text.match(/(?:async)?(?:\s+function)?[^(]*\(([^)]*)/);
  if (!match)
    return [];
  const trimmedParams = match[1].trim();
  if (!trimmedParams)
    return [];
  const [firstParam] = splitByComma(trimmedParams);
  if (firstParam[0] !== '{' || firstParam[firstParam.length - 1] !== '}')
    throw errorWithLocations('First argument must use the object destructuring pattern: '  + firstParam, { location });
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

function errorWithLocations(message: string, ...defined: { location: Location, name?: string, quoted?: boolean }[]): Error {
  for (const { name, location, quoted } of defined) {
    let prefix = '';
    if (name && quoted === false)
      prefix = name + ' ';
    else if (name)
      prefix = `"${name}" `;
    message += `\n  ${prefix}defined at ${formatLocation(location)}`;
  }
  return new Error(message);
}
