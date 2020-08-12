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

const { FixturePool, registerFixture, registerWorkerFixture } = require('../harness/fixturePool');
const { Test, Suite } = require('mocha');
const pirates = require('pirates');
const babel = require('@babel/core');
const commonSuite = require('mocha/lib/interfaces/common');

Error.stackTraceLimit = 15;
global.testOptions = require('../harness/testOptions');
global.registerFixture = registerFixture;
global.registerWorkerFixture = registerWorkerFixture;
process.env.JEST_WORKER_ID = 1;

const fixturePool = new FixturePool();
let revertBabelRequire;

function fixturesUI(trialRun, suite) {
  const suites = [suite];

  suite.on(Suite.constants.EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
    const common = commonSuite(suites, context, mocha);

    const itBuilder = (markers) => {
      return function(title, fn) {
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
        if (markers && markers.includes('slow'))
          test.timeout(90000);
        test.file = file;
        suite.addTest(test);
        return test;
      };
    };

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

    context.describe = (title, fn) => {
      return common.suite.create({
        title: title,
        file: file,
        fn: fn
      });
    };
    context.xdescribe = (title, fn) => {
      return common.suite.skip({
        title: title,
        file: file,
        fn: fn
      });
    };
    context.describe.skip = function(condition) {
      return condition ? context.xdescribe : context.describe;
    };
    context.describe.only = (title, fn) => {
      return common.suite.only({
        title: title,
        file: file,
        fn: fn
      });
    };

    context.fdescribe = context.describe.only;

    context.it = itBuilder();
    context.it.only = function(title, fn) {
      return common.test.only(mocha, context.it(title, fn));
    };
    context.fit = context.it.only;
    context.xit = function(title) {
      return context.it(title);
    };
    context.it.skip = function(condition) {
      return condition ? context.xit : context.it;
    };
    context.it.fail = function(condition) {
      return condition ? context.xit : context.it;
    };
    context.it.slow = () => itBuilder(['slow']);
    context.it.retries = function(n) {
      context.retries(n);
    };

    revertBabelRequire = pirates.addHook((code, filename) => {
      const result = babel.transformFileSync(filename, {
        presets: [
          ['@babel/preset-env', {targets: {node: 'current'}}],
          '@babel/preset-typescript']
      });
      return result.code;
    }, {
      exts: ['.ts']
    });
  });

  suite.on(Suite.constants.EVENT_FILE_POST_REQUIRE, function(context, file, mocha) {
    revertBabelRequire();
  });
};

module.exports = { fixturesUI, fixturePool, registerFixture, registerWorkerFixture };
