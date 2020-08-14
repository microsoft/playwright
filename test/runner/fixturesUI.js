/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { FixturePool, registerFixture, registerWorkerFixture, rerunRegistrations } = require('./fixtures');
const { Test, Suite } = require('mocha');
const { installTransform } = require('./transform');
const commonSuite = require('mocha/lib/interfaces/common');

Error.stackTraceLimit = 15;
global.testOptions = require('./testOptions');
global.registerFixture = registerFixture;
global.registerWorkerFixture = registerWorkerFixture;
process.env.JEST_WORKER_ID = 1;

const fixturePool = new FixturePool();
let revertBabelRequire;

function specBuilder(modifiers, specCallback) {
  function builder(specs, last) {
    const callable = (...args) => {
      if (!last || (typeof args[0] === 'string' && typeof args[1] === 'function')) {
        // Looks like a body (either it or describe). Assume that last modifier is true.
        const newSpecs = { ...specs };
        if (last)
          newSpecs[last] = [true];
        return specCallback(newSpecs, ...args);
      }
      const newSpecs = { ...specs };
      newSpecs[last] = args;
      return builder(newSpecs, null);
    };
    return new Proxy(callable, {
      get: (obj, prop) => {
        if (typeof prop === 'string' && modifiers.includes(prop)) {
          const newSpecs = { ...specs };
          // Modifier was not called, assume true.
          if (last)
            newSpecs[last] = [true];
          return builder(newSpecs, prop);
        }
        return obj[prop];
      },
    });
  }
  return builder({}, null);
}

function fixturesUI(trialRun, suite) {
  const suites = [suite];

  suite.on(Suite.constants.EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
    const common = commonSuite(suites, context, mocha);

    const it = specBuilder(['skip', 'fail', 'slow', 'only'], (specs, title, fn) => {
      const suite = suites[0];
      if (suite.isPending())
        fn = null;
      let wrapper;
      if (trialRun) {
        if (fn)
          wrapper = () => {};
      } else {
        const wrapped = fixturePool.wrapTestCallback(fn);
        wrapper = wrapped ? (done, ...args) => {
          wrapped(...args).then(done).catch(done);
        } : undefined;
      }
      if (wrapper) {
        wrapper.toString = () => fn.toString();
        wrapper.__original = fn;
      }
      const test = new Test(title, wrapper);
      test.file = file;
      suite.addTest(test);
      const only = specs.only && specs.only[0];
      if (specs.slow && specs.slow[0])
        test.timeout(90000);
      if (only)
        test.markOnly();
      if (!only && specs.skip && specs.skip[0])
        test.pending = true;
      if (!only && specs.fail && specs.fail[0])
        test.pending = true;
      return test;
    });

    const describe = specBuilder(['skip', 'fail', 'only'], (specs, title, fn) => {
      const suite = common.suite.create({
        title: title,
        file: file,
        fn: fn
      });
      const only = specs.only && specs.only[0];
      if (only)
        suite.markOnly();
      if (!only && specs.skip && specs.skip[0])
        suite.pending = true;
      if (!only && specs.fail && specs.fail[0])
        suite.pending = true;
      return suite;
    });

    context.beforeEach = common.beforeEach;
    context.afterEach = common.afterEach;
    if (trialRun) {
      context.beforeEach = () => {};
      context.afterEach = () => {};
    } else {
      context.beforeEach = common.beforeEach;
      context.afterEach = common.afterEach;
      fixturePool.patchToEnableFixtures(context, 'beforeEach');
      fixturePool.patchToEnableFixtures(context, 'afterEach');
    }

    context.run = mocha.options.delay && common.runWithSuite(suite);

    context.describe = describe;
    context.fdescribe = describe.only(true);
    context.xdescribe = describe.skip(true);
    context.it = it;
    context.fit = it.only(true);
    context.xit = it.skip(true);

    revertBabelRequire = installTransform();
  });

  suite.on(Suite.constants.EVENT_FILE_POST_REQUIRE, function(context, file, mocha) {
    revertBabelRequire();
    rerunRegistrations(file, 'test');
  });
};

module.exports = { fixturesUI, fixturePool, registerFixture, registerWorkerFixture };
