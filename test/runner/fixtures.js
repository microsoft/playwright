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

const debug = require('debug');

const registrations = new Map();
const registrationsByFile = new Map();
const optionRegistrations = new Map();
const optionsImpl = new Map();
const options = new Proxy({}, {
  get: (obj, prop) => {
    if (optionsImpl.has(prop))
      return optionsImpl.get(prop);
    const fn = optionRegistrations.get(prop);
    if (!fn)
      return obj[prop];
    const names = optionParameterNames(fn);
    const param = {};
    names.forEach(name => param[name] = options[name]);
    const result = fn.call(null, param);
    optionsImpl.set(prop, result);
    return result;
  }
});

function setOptions(map) {
  optionsImpl.clear();
  for (const [name, value] of map)
    optionsImpl.set(name, value);
}

class Fixture {
  constructor(pool, name, scope, fn) {
    this.pool = pool;
    this.name = name;
    this.scope = scope;
    this.fn = fn;
    this.deps = fixtureParameterNames(this.fn);
    this.usages = new Set();
    this.generatorValue = optionsImpl.get(name);
    this.value = this.generatorValue || null;
  }

  async setup() {
    if (this.generatorValue)
      return;
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
    if (this.generatorValue)
      return;
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

function fixturesForCallback(callback) {
  const names = new Set();
  const visit  = (callback) => {
    for (const name of fixtureParameterNames(callback)) {
      if (name in names)
        continue;
        names.add(name);
      const { fn } = registrations.get(name)
      visit(fn);
    }
  };
  visit(callback);
  const result = [...names];
  result.sort();
  return result;
}

function fixtureParameterNames(fn) {
  const text = fn.toString();
  const match = text.match(/async(?:\s+function)?\s*\(\s*{\s*([^}]*)\s*}/);
  if (!match || !match[1].trim())
    return [];
  let signature = match[1];
  return signature.split(',').map(t => t.trim());
}

function optionParameterNames(fn) {
  const text = fn.toString();
  const match = text.match(/(?:\s+function)?\s*\(\s*{\s*([^}]*)\s*}/);
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

function registerWorkerFixture(name, fn) {
  innerRegisterFixture(name, 'worker', fn);
};

function registerOptionGenerator(name, fn) {
  registerWorkerFixture(name, async ({}, test) => await test(options.browserName));
  optionRegistrations.set(name, fn);
}

function registerOption(name, fn) {
  optionRegistrations.set(name, fn);
}

function collectRequires(file, result) {
  if (result.has(file))
    return;
  result.add(file);
  const cache = require.cache[file];
  if (!cache)
    return;
  const deps = cache.children.map(m => m.id).slice().reverse();
  for (const dep of deps)
    collectRequires(dep, result);
}

function lookupRegistrations(file, scope) {
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

function rerunRegistrations(file, scope) {
  // When we are running several tests in the same worker, we should re-run registrations before
  // each file. That way we erase potential fixture overrides from the previous test runs.
  for (const registration of lookupRegistrations(file, scope).values())
    registrations.set(registration.name, registration);
}

module.exports = { FixturePool, registerFixture, registerWorkerFixture, rerunRegistrations, lookupRegistrations, fixturesForCallback, registerOption, registerOptionGenerator, setOptions, optionRegistrations, options };
