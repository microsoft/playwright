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

const NodeEnvironment = require('jest-environment-node');
const path = require('path');
const playwright = require('../../index');

class PlaywrightEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.fixturePool = new FixturePool();

    this.global.registerFixture = (name, fn) => {
      this.fixturePool.registerFixture(name, 'test', fn);
    };

    this.global.registerWorkerFixture = (name, fn) => {
      this.fixturePool.registerFixture(name, 'worker', fn);
    };

    this.global.registerWorkerFixture('browser', async (test) => {
      const browser = await playwright[process.env.BROWSER || 'chromium'].launch();
      await test(browser);
      await browser.close();
    });

    this.global.registerFixture('context', async (browser, test) => {
      const context = await browser.newContext();
      await test(context);
      await context.close();
    });

    this.global.registerFixture('page', async (context, test) => {
      const page = await context.newPage();
      await test(page);
    });
  }

  async setup() {
    await super.setup();
  }

  async teardown() {
    await this.fixturePool.teardownScope('worker');
    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }

  async handleTestEvent(event, state) {
    if (event.name === 'test_start') {
      const fn = event.test.fn;
      event.test.fn = async () => {
        try {
          return await this.fixturePool.resolveParametersAndRun(fn);
        } finally {
          await this.fixturePool.teardownScope('test');
        }
      };
    }
  }
}

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

    const params = this.deps.map(n => this.pool.instances.get(n).value);
    let setupFenceCallback;
    const setupFence = new Promise(f => setupFenceCallback = f);
    const teardownFence = new Promise(f => this._teardownFenceCallback = f);
    this._tearDownComplete = this.fn(...params, async value => {
      this.value = value;
      setupFenceCallback();
      await teardownFence;
    });
    await setupFence;
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
    this._teardownFenceCallback();
    await this._tearDownComplete;
    this.pool.instances.delete(this.name);
  }
}

class FixturePool {
  constructor() {
    this.registrations = new Map();
    this.instances = new Map();
  }

  registerFixture(name, scope, fn) {
    this.registrations.set(name, { scope, fn });
  }

  async setupFixture(name) {
    let fixture = this.instances.get(name);
    if (fixture)
      return fixture;

    const { scope, fn } = this.registrations.get(name);
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
    await fn(...names.map(n => this.instances.get(n).value));
  }
}

exports.getPlaywrightEnv = () => PlaywrightEnvironment;
exports.default = exports.getPlaywrightEnv();

function fixtureParameterNames(fn) {
  const text = fn.toString();
  const match = text.match(/async\ (.*) =>/);
  if (!match)
    return [];
  let signature = match[1];
  if (signature.startsWith('(') && signature.endsWith(')'))
    signature = signature.substring(1, signature.length - 1);
  if (!signature.trim())
    return [];
  const result = signature.split(',').map(t => t.trim());
  return result.filter(s => s !== 'test');
}
