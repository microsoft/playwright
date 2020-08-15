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

const crypto = require('crypto');
const debug = require('debug');

const registrations = new Map();
const registrationsByFile = new Map();

class Fixture {
  constructor(pool, name, scope, fn) {
    this.pool = pool;
    this.name = name;
    this.scope = scope;
    this.fn = fn;
    this.deps = fixtureParameterNames(this.fn);
    this.usages = new Set();
    this.value = null;
  }

  async setup() {
    for (const name of this.deps) {
      await this.pool.setupFixture(name);
      this.pool.instances.get(name).usages.add(this.name);
    }

    const params = {};
    for (const n of this.deps)
      params[n] = this.pool.instances.get(n).value;
    let setupFenceFulfill;
    let setupFenceReject;
    const setupFence = new Promise((f, r) => { setupFenceFulfill = f; setupFenceReject = r; });
    const teardownFence = new Promise(f => this._teardownFenceCallback = f);
    debug('pw:test:hook')(`setup "${this.name}"`);
    this._tearDownComplete = this.fn(params, async value => {
      this.value = value;
      setupFenceFulfill();
      await teardownFence;
    }).catch(e => setupFenceReject(e));
    await setupFence;
    this._setup = true;
  }

  async teardown() {
    if (this._teardown)
      return;
    this._teardown = true;
    for (const name of this.usages) {
      const fixture = this.pool.instances.get(name);
      if (!fixture)
        continue;
      await fixture.teardown();
    }
    if (this._setup) {
      debug('pw:test:hook')(`teardown "${this.name}"`);
      this._teardownFenceCallback();
    }
    await this._tearDownComplete;
    this.pool.instances.delete(this.name);
  }
}

class FixturePool {
  constructor() {
    this.instances = new Map();
  }

  async setupFixture(name) {
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

  async teardownScope(scope) {
    for (const [name, fixture] of this.instances) {
      if (fixture.scope === scope)
        await fixture.teardown();
    }
  }

  async resolveParametersAndRun(fn) {
    const names = fixtureParameterNames(fn);
    for (const name of names)
      await this.setupFixture(name);
    const params = {};
    for (const n of names)
      params[n] = this.instances.get(n).value;
    return fn(params);
  }

  wrapTestCallback(callback) {
    if (!callback)
      return callback;
    return async() => {
      try {
        return await this.resolveParametersAndRun(callback);
      } finally {
        await this.teardownScope('test');
      }
    };
  }
}

function fixtureParameterNames(fn) {
  const text = fn.toString();
  const match = text.match(/async(?:\s+function)?\s*\(\s*{\s*([^}]*)\s*}/);
  if (!match || !match[1].trim())
    return [];
  let signature = match[1];
  return signature.split(',').map(t => t.trim());
}

function innerRegisterFixture(name, scope, fn) {
  const stackFrame = new Error().stack.split('\n').slice(1).filter(line => !line.includes(__filename))[0];
  const location = stackFrame.replace(/.*at Object.<anonymous> \((.*)\)/, '$1');
  const file = location.replace(/^(.+):\d+:\d+$/, '$1');
  const registration = { name, scope, fn, file, location };
  registrations.set(name, registration);
  if (!registrationsByFile.has(file))
    registrationsByFile.set(file, []);
  registrationsByFile.get(file).push(registration);
};

function registerFixture(name, fn) {
  innerRegisterFixture(name, 'test', fn);
};

function registerWorkerFixture (name, fn) {
  innerRegisterFixture(name, 'worker', fn);
};

function collectRequires(file, result) {
  if (result.has(file))
    return;
  result.add(file);
  const cache = require.cache[file];
  const deps = cache.children.map(m => m.id).slice().reverse();
  for (const dep of deps)
    collectRequires(dep, result);
}

function lookupRegistrations(file, scope) {
  const deps = new Set();
  collectRequires(file, deps);
  const allDeps = [...deps].reverse();
  let result = [];
  for (const dep of allDeps) {
    const registrationList = registrationsByFile.get(dep);
    if (!registrationList)
      continue;
    result = result.concat(registrationList.filter(r => r.scope === scope));
  }
  return result;
}

function rerunRegistrations(file, scope) {
  // When we are running several tests in the same worker, we should re-run registrations before
  // each file. That way we erase potential fixture overrides from the previous test runs.
  for (const registration of lookupRegistrations(file, scope))
    registrations.set(registration.name, registration);
}

function computeWorkerHash(file) {
  // At this point, registrationsByFile contains all the files with worker fixture registrations.
  // For every test, build the require closure and map each file to fixtures declared in it.
  // This collection of fixtures is the fingerprint of the worker setup, a "worker hash".
  // Tests with the matching "worker hash" will reuse the same worker.
  const hash = crypto.createHash('sha1');
  for (const registration of lookupRegistrations(file, 'worker'))
    hash.update(registration.location);
  return hash.digest('hex');
}

module.exports = { FixturePool, registerFixture, registerWorkerFixture, computeWorkerHash, rerunRegistrations };
