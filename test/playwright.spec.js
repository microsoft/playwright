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

module.exports.addTests = ({testRunner, product, playwrightPath}) => {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const CHROME = product === 'Chromium';
  const FFOX = product === 'Firefox';
  const WEBKIT = product === 'WebKit';
  const MAC = os.platform() === 'darwin';
  const LINUX = os.platform() === 'linux';
  const WIN = os.platform() === 'win32';

  const playwright = require(playwrightPath);

  const headless = (process.env.HEADLESS || 'true').trim().toLowerCase() === 'true';
  const slowMo = parseInt((process.env.SLOW_MO || '0').trim(), 10);

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
    CHROME,
    MAC,
    LINUX,
    WIN,
    playwright,
    expect,
    defaultBrowserOptions,
    playwrightPath,
    headless: !!defaultBrowserOptions.headless,
    ASSETS_DIR,
  };

  describe('Browser', function() {
    beforeAll(async state => {
      state.browser = await playwright.launch(defaultBrowserOptions);
    });

    afterAll(async state => {
      await state.browser.close();
      state.browser = null;
    });

    if (!WEBKIT) {
      beforeEach(async(state, test) => {
        const rl = require('readline').createInterface({input: state.browser.process().stderr});
        test.output = '';
        rl.on('line', onLine);
        state.tearDown = () => {
          rl.removeListener('line', onLine);
          rl.close();
        };
        function onLine(line) {
          test.output += line + '\n';
        }
      });
    }

    if (!WEBKIT) {
      afterEach(async state => {
        state.tearDown();
      });
    }

    describe('Page', function() {
      beforeEach(async state => {
        state.context = await state.browser.newContext();
        state.page = await state.context.newPage();
      });

      afterEach(async state => {
        // This closes all pages.
        await state.context.close();
        state.context = null;
        state.page = null;
      });

      // Page-level tests that are given a browser, a context and a page.
      // Each test is launched in a new browser context.
      require('./browser.spec.js').addTests(testOptions);
      require('./click.spec.js').addTests(testOptions);
      require('./cookies.spec.js').addTests(testOptions);
      require('./dialog.spec.js').addTests(testOptions);
      require('./elementhandle.spec.js').addTests(testOptions);
      require('./emulation.spec.js').addTests(testOptions);
      require('./evaluation.spec.js').addTests(testOptions);
      require('./frame.spec.js').addTests(testOptions);
      require('./input.spec.js').addTests(testOptions);
      require('./jshandle.spec.js').addTests(testOptions);
      require('./keyboard.spec.js').addTests(testOptions);
      require('./mouse.spec.js').addTests(testOptions);
      require('./navigation.spec.js').addTests(testOptions);
      require('./network.spec.js').addTests(testOptions);
      require('./page.spec.js').addTests(testOptions);
      require('./queryselector.spec.js').addTests(testOptions);
      require('./screenshot.spec.js').addTests(testOptions);
      require('./waittask.spec.js').addTests(testOptions);

      if (CHROME) {
        require('./chromium/chromium.spec.js').addTests(testOptions);
        require('./chromium/coverage.spec.js').addTests(testOptions);
        require('./chromium/geolocation.spec.js').addTests(testOptions);
        require('./chromium/pdf.spec.js').addTests(testOptions);
        require('./chromium/session.spec.js').addTests(testOptions);
        require('./chromium/workers.spec.js').addTests(testOptions);
      }

      if (CHROME || FFOX) {
        require('./features/accessibility.spec.js').addTests(testOptions);
        require('./features/permissions.spec.js').addTests(testOptions);
        require('./features/interception.spec.js').addTests(testOptions);
      }

    });

    // Browser-level tests that are given a browser.
    require('./browsercontext.spec.js').addTests(testOptions);
  });

  // Top-level tests that launch Browser themselves.
  require('./defaultbrowsercontext.spec.js').addTests(testOptions);
  require('./fixtures.spec.js').addTests(testOptions);
  require('./ignorehttpserrors.spec.js').addTests(testOptions);
  require('./launcher.spec.js').addTests(testOptions);

  if (CHROME) {
    require('./chromium/connect.spec.js').addTests(testOptions);
    require('./chromium/launcher.spec.js').addTests(testOptions);
    require('./chromium/headful.spec.js').addTests(testOptions);
    require('./chromium/oopif.spec.js').addTests(testOptions);
    require('./chromium/tracing.spec.js').addTests(testOptions);
  }

  if (FFOX) {
    require('./firefox/launcher.spec.js').addTests(testOptions);
  }

  if (WEBKIT) {
    require('./webkit/launcher.spec.js').addTests(testOptions);
  }
};
