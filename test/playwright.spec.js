/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
const fs = require('fs');
const path = require('path');
const os = require('os');
const rm = require('rimraf').sync;
const GoldenUtils = require('./golden-utils');
const {Matchers} = require('../utils/testrunner/');

const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

/**
 * @type {TestSuite}
 */
module.exports.describe = ({testRunner, product, playwrightPath}) => {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const CHROMIUM = product === 'Chromium';
  const FFOX = product === 'Firefox';
  const WEBKIT = product === 'WebKit';
  const MAC = os.platform() === 'darwin';
  const LINUX = os.platform() === 'linux';
  const WIN = os.platform() === 'win32';

  const playwrightModule = require(playwrightPath);
  const playwright = playwrightModule[product.toLowerCase()];

  const headless = !!valueFromEnv('HEADLESS', true);
  const slowMo = valueFromEnv('SLOW_MO', 0);
  const dumpProtocolOnFailure = valueFromEnv('DEBUGP', false);

  function valueFromEnv(name, defaultValue) {
    if (!(name in process.env))
      return defaultValue;
    return JSON.parse(process.env[name]);
  }
  const executablePath = {
    'Chromium': process.env.CRPATH,
    'Firefox': process.env.FFPATH,
    'WebKit': process.env.WKPATH,
  }[product];
  const defaultBrowserOptions = {
    handleSIGINT: false,
    executablePath,
    slowMo,
    headless,
    dumpio: !!process.env.DUMPIO,
  };

  if (defaultBrowserOptions.executablePath) {
    console.warn(`${YELLOW_COLOR}WARN: running ${product} tests with ${defaultBrowserOptions.executablePath}${RESET_COLOR}`);
  } else {
    // Make sure the `npm install` was run after the chromium roll.
    if (!fs.existsSync(playwright.executablePath()))
      throw new Error(`Browser is not downloaded. Run 'npm install' and try to re-run tests`);
  }

  const GOLDEN_DIR = path.join(__dirname, 'golden-' + product.toLowerCase());
  const OUTPUT_DIR = path.join(__dirname, 'output-' + product.toLowerCase());
  const ASSETS_DIR = path.join(__dirname, 'assets');
  if (fs.existsSync(OUTPUT_DIR))
    rm(OUTPUT_DIR);
  const {expect} = new Matchers({
    toBeGolden: GoldenUtils.compare.bind(null, GOLDEN_DIR, OUTPUT_DIR)
  });

  const testOptions = {
    testRunner,
    product,
    FFOX,
    WEBKIT,
    CHROMIUM,
    MAC,
    LINUX,
    WIN,
    playwright,
    selectors: playwrightModule.selectors,
    expect,
    defaultBrowserOptions,
    playwrightPath,
    headless: !!defaultBrowserOptions.headless,
    ASSETS_DIR,
  };

  describe('Browser', function() {
    beforeAll(async state => {
      state.browser = await playwright.launch(defaultBrowserOptions);
      state.browserServer = state.browser.__server__;
    });

    afterAll(async state => {
      await state.browserServer.close();
      state.browser = null;
      state.browserServer = null;
    });

    beforeEach(async(state, test) => {
      const onLine = (line) => test.output += line + '\n';
      if (dumpProtocolOnFailure)
        state.browser._setDebugFunction(onLine);

      let rl;
      if (state.browserServer.process().stderr) {
        rl = require('readline').createInterface({ input: state.browserServer.process().stderr });
        test.output = '';
        rl.on('line', onLine);
      }

      state.tearDown = async () => {
        if (rl) {
          rl.removeListener('line', onLine);
          rl.close();
        }
        if (dumpProtocolOnFailure)
          state.browser._setDebugFunction(() => void 0);
      };
    });

    afterEach(async (state, test) => {
      if (state.browser.contexts().length !== 0) {
        if (test.result === 'ok')
          console.warn(`\nWARNING: test "${test.fullName}" (${test.location.fileName}:${test.location.lineNumber}) did not close all created contexts!\n`);
        await Promise.all(state.browser.contexts().map(context => context.close()));
      }
      await state.tearDown();
    });

    describe('Page', function() {
      beforeEach(async state => {
        state.context = await state.browser.newContext();
        state.page = await state.context.newPage();
      });

      afterEach(async state => {
        await state.context.close();
        state.context = null;
        state.page = null;
      });

      // Page-level tests that are given a browser, a context and a page.
      // Each test is launched in a new browser context.
      testRunner.loadTests(require('./accessibility.spec.js'), testOptions);
      testRunner.loadTests(require('./click.spec.js'), testOptions);
      testRunner.loadTests(require('./cookies.spec.js'), testOptions);
      testRunner.loadTests(require('./dialog.spec.js'), testOptions);
      testRunner.loadTests(require('./elementhandle.spec.js'), testOptions);
      testRunner.loadTests(require('./emulation.spec.js'), testOptions);
      testRunner.loadTests(require('./evaluation.spec.js'), testOptions);
      testRunner.loadTests(require('./frame.spec.js'), testOptions);
      testRunner.loadTests(require('./focus.spec.js'), testOptions);
      testRunner.loadTests(require('./input.spec.js'), testOptions);
      testRunner.loadTests(require('./jshandle.spec.js'), testOptions);
      testRunner.loadTests(require('./keyboard.spec.js'), testOptions);
      testRunner.loadTests(require('./mouse.spec.js'), testOptions);
      testRunner.loadTests(require('./navigation.spec.js'), testOptions);
      testRunner.loadTests(require('./network.spec.js'), testOptions);
      testRunner.loadTests(require('./page.spec.js'), testOptions);
      testRunner.loadTests(require('./queryselector.spec.js'), testOptions);
      testRunner.loadTests(require('./screenshot.spec.js'), testOptions);
      testRunner.loadTests(require('./waittask.spec.js'), testOptions);
      testRunner.loadTests(require('./interception.spec.js'), testOptions);
      testRunner.loadTests(require('./geolocation.spec.js'), testOptions);
      testRunner.loadTests(require('./workers.spec.js'), testOptions);
      testRunner.loadTests(require('./capabilities.spec.js'), testOptions);

      if (CHROMIUM) {
        testRunner.loadTests(require('./chromium/chromium.spec.js'), testOptions);
        testRunner.loadTests(require('./chromium/coverage.spec.js'), testOptions);
        testRunner.loadTests(require('./chromium/pdf.spec.js'), testOptions);
        testRunner.loadTests(require('./chromium/session.spec.js'), testOptions);
      }

      if (CHROMIUM || FFOX) {
        testRunner.loadTests(require('./features/permissions.spec.js'), testOptions);
      }

      if (WEBKIT) {
        testRunner.loadTests(require('./webkit/provisional.spec.js'), testOptions);
      }
    });

    // Browser-level tests that are given a browser.
    testRunner.loadTests(require('./browser.spec.js'), testOptions);
    testRunner.loadTests(require('./browsercontext.spec.js'), testOptions);
    testRunner.loadTests(require('./ignorehttpserrors.spec.js'), testOptions);
    testRunner.loadTests(require('./popup.spec.js'), testOptions);
  });

  // Top-level tests that launch Browser themselves.
  testRunner.loadTests(require('./defaultbrowsercontext.spec.js'), testOptions);
  testRunner.loadTests(require('./fixtures.spec.js'), testOptions);
  testRunner.loadTests(require('./launcher.spec.js'), testOptions);
  testRunner.loadTests(require('./headful.spec.js'), testOptions);
  testRunner.loadTests(require('./multiclient.spec.js'), testOptions);

  if (CHROMIUM) {
    testRunner.loadTests(require('./chromium/launcher.spec.js'), testOptions);
    testRunner.loadTests(require('./chromium/headful.spec.js'), testOptions);
    testRunner.loadTests(require('./chromium/oopif.spec.js'), testOptions);
    testRunner.loadTests(require('./chromium/tracing.spec.js'), testOptions);
  }

  testRunner.loadTests(require('./web.spec.js'), testOptions);
};
