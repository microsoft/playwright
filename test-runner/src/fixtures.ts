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

import debug from 'debug';
import { Test } from './test';

declare global {
  interface WorkerState {
  }

  interface TestState {
  }

  interface FixtureParameters {
  }
}

const registrations = new Map();
const registrationsByFile = new Map();
export let parameters: FixtureParameters = {} as FixtureParameters;
export const parameterRegistrations = new Map();

export function setParameters(params: any) {
  parameters = Object.assign(parameters, params);
  for (const name of Object.keys(params))
    registerWorkerFixture(name as keyof WorkerState, async ({}, test) => await test(parameters[name] as never));
}

type TestConfig = {
  outputDir: string;
  testDir: string;
};

type TestResult = {
  success: boolean;
  test: Test;
  config: TestConfig;
  error?: Error;
};

class Fixture {
  pool: FixturePool;
  name: string;
  scope: any;
  fn: any;
  deps: any;
  usages: Set<unknown>;
  hasGeneratorValue: boolean;
  value: any;
  _teardownFenceCallback: (value?: unknown) => void;
  _tearDownComplete: any;
  _setup: boolean;
  _teardown: any;
  constructor(pool: FixturePool, name: string, scope: any, fn: any) {
    this.pool = pool;
    this.name = name;
    this.scope = scope;
    this.fn = fn;
    this.deps = fixtureParameterNames(this.fn);
    this.usages = new Set();
    this.hasGeneratorValue = name in parameters;
    this.value = this.hasGeneratorValue ? parameters[name] : null;
  }

  async setup() {
    if (this.hasGeneratorValue)
      return;
    for (const name of this.deps) {
      await this.pool.setupFixture(name);
      this.pool.instances.get(name).usages.add(this.name);
    }

    const params = {};
    for (const n of this.deps)
      params[n] = this.pool.instances.get(n).value;
    let setupFenceFulfill: { (): void; (value?: unknown): void; };
    let setupFenceReject: { (arg0: any): any; (reason?: any): void; };
    const setupFence = new Promise((f, r) => { setupFenceFulfill = f; setupFenceReject = r; });
    const teardownFence = new Promise(f => this._teardownFenceCallback = f);
    debug('pw:test:hook')(`setup "${this.name}"`);
    this._tearDownComplete = this.fn(params, async (value: any) => {
      this.value = value;
      setupFenceFulfill();
      return await teardownFence;
    }).catch((e: any) => setupFenceReject(e));
    await setupFence;
    this._setup = true;
  }

  async teardown(testResult: TestResult) {
    if (this.hasGeneratorValue)
      return;
    if (this._teardown)
      return;
    this._teardown = true;
    for (const name of this.usages) {
      const fixture = this.pool.instances.get(name);
      if (!fixture)
        continue;
      await fixture.teardown(testResult);
    }
    if (this._setup) {
      debug('pw:test:hook')(`teardown "${this.name}"`);
      this._teardownFenceCallback(testResult);
    }
    await this._tearDownComplete;
    this.pool.instances.delete(this.name);
  }
}

export class FixturePool {
  instances: Map<any, any>;
  constructor() {
    this.instances = new Map();
  }

  async setupFixture(name: string) {
    let fixture = this.instances.get(name);
    if (fixture)
      return fixture;

    if (!registrations.has(name))
      throw new Error('Unknown fixture: ' + name);
    const { scope, fn } = registrations.get(name);
    fixture = new Fixture(this, name, scope, fn);
    this.instances.set(name, fixture);
    await fixture.setup();
    return fixture;
  }

  async teardownScope(scope: string, testResult?: TestResult) {
    for (const [name, fixture] of this.instances) {
      if (fixture.scope === scope)
        await fixture.teardown(testResult);
    }
  }

  async resolveParametersAndRun(fn: (arg0: {}) => any, timeout: number) {
    const names = fixtureParameterNames(fn);
    for (const name of names)
      await this.setupFixture(name);
    const params = {};
    for (const n of names)
      params[n] = this.instances.get(n).value;

    if (!timeout)
      return fn(params);

    let timer;
    let timerPromise = new Promise(f => timer = setTimeout(f, timeout));
    return Promise.race([
      Promise.resolve(fn(params)).then(() => clearTimeout(timer)),
      timerPromise.then(() => Promise.reject(new Error(`Timeout of ${timeout}ms exceeded`)))
    ]);
  }

  wrapTestCallback(callback: any, timeout: number, test: Test, config: TestConfig) {
    if (!callback)
      return callback;
    const testResult: TestResult = { success: true, test, config };
    return async() => {
      try {
        await this.resolveParametersAndRun(callback, timeout);
      } catch (e) {
        testResult.success = false;
        testResult.error = e;
        throw e;
      } finally {
        await this.teardownScope('test', testResult);
      }
    };
  }
}

export function fixturesForCallback(callback: any): string[] {
  const names = new Set<string>();
  const visit  = (callback: any) => {
    for (const name of fixtureParameterNames(callback)) {
      if (name in names)
        continue;
        names.add(name);
      if (!registrations.has(name)) {
        throw new Error('Using undefined fixture ' + name);
      }
      const { fn } = registrations.get(name);
      visit(fn);
    }
  };
  visit(callback);
  const result = [...names];
  result.sort();
  return result;
}

function fixtureParameterNames(fn: { toString: () => any; }) {
  const text = fn.toString();
  const match = text.match(/async(?:\s+function)?\s*\(\s*{\s*([^}]*)\s*}/);
  if (!match || !match[1].trim())
    return [];
  let signature = match[1];
  return signature.split(',').map((t: string) => t.trim());
}

function innerRegisterFixture(name: any, scope: string, fn: any, caller: Function) {
  const obj = {stack: ''};
  Error.captureStackTrace(obj, caller);
  const stackFrame = obj.stack.split('\n')[1];
  const location = stackFrame.replace(/.*at Object.<anonymous> \((.*)\)/, '$1');
  const file = location.replace(/^(.+):\d+:\d+$/, '$1');
  const registration = { name, scope, fn, file, location };
  registrations.set(name, registration);
  if (!registrationsByFile.has(file))
    registrationsByFile.set(file, []);
  registrationsByFile.get(file).push(registration);
};

export function registerFixture<T extends keyof TestState>(name: T, fn: (params: FixtureParameters & WorkerState & TestState, test: (arg: TestState[T]) => Promise<TestResult>) => Promise<void>) {
  innerRegisterFixture(name, 'test', fn, registerFixture);
};

export function registerWorkerFixture<T extends keyof (WorkerState & FixtureParameters)>(name: T, fn: (params: FixtureParameters & WorkerState, test: (arg: (WorkerState & FixtureParameters)[T]) => Promise<void>) => Promise<void>) {
  innerRegisterFixture(name, 'worker', fn, registerWorkerFixture);
};

export function registerParameter<T extends keyof WorkerState>(name: T, fn: () => WorkerState[T][]) {
  registerWorkerFixture(name, async ({}: any, test: (arg0: any) => any) => await test(parameters[name]));
  parameterRegistrations.set(name, fn);
}

function collectRequires(file: string | number, result: Set<unknown>) {
  if (result.has(file))
    return;
  result.add(file);
  const cache = require.cache[file];
  if (!cache)
    return;
  const deps = cache.children.map((m: { id: any; }) => m.id).slice().reverse();
  for (const dep of deps)
    collectRequires(dep, result);
}

export function lookupRegistrations(file: any, scope: any) {
  const deps = new Set();
  collectRequires(file, deps);
  const allDeps = [...deps].reverse();
  let result = new Map();
  for (const dep of allDeps) {
    const registrationList = registrationsByFile.get(dep);
    if (!registrationList)
      continue;
    for (const r of registrationList) {
      if (scope && r.scope !== scope)
        continue;
        result.set(r.name, r);
    }
  }
  return result;
}

export function rerunRegistrations(file: any, scope: any) {
  // When we are running several tests in the same worker, we should re-run registrations before
  // each file. That way we erase potential fixture overrides from the previous test runs.
  for (const registration of lookupRegistrations(file, scope).values())
    registrations.set(registration.name, registration);
}
