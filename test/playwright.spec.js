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
const rm = require('rimraf').sync;
const readline = require('readline');
const {TestServer} = require('../utils/testserver/');
const {Environment} = require('../utils/testrunner/Test');

const serverEnvironment = new Environment('TestServer');
serverEnvironment.beforeAll(async state => {
  const assetsPath = path.join(__dirname, 'assets');
  const cachedPath = path.join(__dirname, 'assets', 'cached');

  const port = 8907 + state.parallelIndex * 3;
  state.server = await TestServer.create(assetsPath, port);
  state.server.enableHTTPCache(cachedPath);
  state.server.PORT = port;
  state.server.PREFIX = `http://localhost:${port}`;
  state.server.CROSS_PROCESS_PREFIX = `http://127.0.0.1:${port}`;
  state.server.EMPTY_PAGE = `http://localhost:${port}/empty.html`;

  const httpsPort = port + 1;
  state.httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
  state.httpsServer.enableHTTPCache(cachedPath);
  state.httpsServer.PORT = httpsPort;
  state.httpsServer.PREFIX = `https://localhost:${httpsPort}`;
  state.httpsServer.CROSS_PROCESS_PREFIX = `https://127.0.0.1:${httpsPort}`;
  state.httpsServer.EMPTY_PAGE = `https://localhost:${httpsPort}/empty.html`;

  const sourcePort = port + 2;
  state.sourceServer = await TestServer.create(path.join(__dirname, '..'), sourcePort);
  state.sourceServer.PORT = sourcePort;
  state.sourceServer.PREFIX = `http://localhost:${sourcePort}`;
});
serverEnvironment.afterAll(async({server, sourceServer, httpsServer}) => {
  await Promise.all([
    server.stop(),
    httpsServer.stop(),
    sourceServer.stop(),
  ]);
});
serverEnvironment.beforeEach(async({server, httpsServer}) => {
  server.reset();
  httpsServer.reset();
});

const goldenEnvironment = new Environment('Golden');
goldenEnvironment.beforeAll(async ({browserType}) => {
  const { OUTPUT_DIR, GOLDEN_DIR } = require('./utils').testOptions(browserType);
  if (fs.existsSync(OUTPUT_DIR))
    rm(OUTPUT_DIR);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  expect.setupGolden(GOLDEN_DIR, OUTPUT_DIR);
});

/**
 * @type {TestSuite}
 */
module.exports.addPlaywrightTests = ({testRunner, products}) => {
  const dumpProtocolOnFailure = valueFromEnv('DEBUGP', false);
  const playwrightPath = require('./utils').projectRoot();
  const playwright = require(playwrightPath);

  const playwrightEnvironment = new Environment('Playwright');
  playwrightEnvironment.beforeAll(async state => {
    state.playwright = playwright;
    global.playwright = playwright;
  });
  playwrightEnvironment.afterAll(async state => {
    delete state.playwright;
    delete global.playwright;
  });

  for (const product of products) {
    const browserTypeEnvironment = new Environment('BrowserType');
    browserTypeEnvironment.beforeAll(async state => {
      state.browserType = state.playwright[product.toLowerCase()];
    });
    browserTypeEnvironment.afterAll(async state => {
      delete state.browserType;
    });

    const browserEnvironment = new Environment(product);
    browserEnvironment.beforeAll(async state => {
      const { defaultBrowserOptions } = require('./utils').testOptions(state.browserType);
      state.browser = await state.browserType.launch(defaultBrowserOptions);
      state.browserServer = state.browser._ownedServer;
      state._stdout = readline.createInterface({ input: state.browserServer.process().stdout });
      state._stderr = readline.createInterface({ input: state.browserServer.process().stderr });
    });
    browserEnvironment.afterAll(async state => {
      await state.browserServer.close();
      state.browser = null;
      state.browserServer = null;
      state._stdout.close();
      state._stderr.close();
    });
    browserEnvironment.beforeEach(async(state, testRun) => {
      const dumpout = data => testRun.log(`\x1b[33m[pw:stdio:out]\x1b[0m ${data}`);
      const dumperr = data => testRun.log(`\x1b[31m[pw:stdio:err]\x1b[0m ${data}`);
      state._stdout.on('line', dumpout);
      state._stderr.on('line', dumperr);
      if (dumpProtocolOnFailure)
        state.browser._debugProtocol.log = data => testRun.log(`\x1b[32m[pw:protocol]\x1b[0m ${data}`);
      state.tearDown = async () => {
        state._stdout.off('line', dumpout);
        state._stderr.off('line', dumperr);
        if (dumpProtocolOnFailure)
          delete state.browser._debugProtocol.log;
      };
    });
    browserEnvironment.afterEach(async (state, test) => {
      if (state.browser.contexts().length !== 0) {
        if (test.result === 'ok')
          console.warn(`\nWARNING: test "${test.fullName()}" (${test.location()}) did not close all created contexts!\n`);
        await Promise.all(state.browser.contexts().map(context => context.close()));
      }
      await state.tearDown();
    });

    const pageEnvironment = new Environment('Page');
    pageEnvironment.beforeEach(async state => {
      state.context = await state.browser.newContext();
      state.page = await state.context.newPage();
    });
    pageEnvironment.afterEach(async state => {
      await state.context.close();
      state.context = null;
      state.page = null;
    });

    testRunner.collector().useEnvironment(serverEnvironment);  // Custom global environment.
    testRunner.collector().useEnvironment(playwrightEnvironment);

    describe(product, () => {
      // In addition to state, expose these two on global so that describes can access them.
      global.playwright = playwright;
      global.browserType = playwright[product.toLowerCase()];

      testRunner.collector().useEnvironment(browserTypeEnvironment);
      testRunner.collector().useEnvironment(goldenEnvironment);  // Custom environment.

      describe('', function() {
        testRunner.collector().useEnvironment(browserEnvironment);

        describe('', function() {
          testRunner.collector().useEnvironment(pageEnvironment);

          // Page-level tests that are given a browser, a context and a page.
          // Each test is launched in a new browser context.
          require('./accessibility.spec.js');
          require('./autowaiting.spec.js');
          require('./click.spec.js');
          require('./cookies.spec.js');
          require('./dialog.spec.js');
          require('./download.spec.js');
          require('./elementhandle.spec.js');
          require('./emulation.spec.js');
          require('./evaluation.spec.js');
          require('./frame.spec.js');
          require('./focus.spec.js');
          require('./input.spec.js');
          require('./jshandle.spec.js');
          require('./keyboard.spec.js');
          require('./mouse.spec.js');
          require('./navigation.spec.js');
          require('./network.spec.js');
          require('./page.spec.js');
          require('./queryselector.spec.js');
          require('./screenshot.spec.js');
          require('./waittask.spec.js');
          require('./interception.spec.js');
          require('./geolocation.spec.js');
          require('./workers.spec.js');
          require('./capabilities.spec.js');
          require('./permissions.spec.js');

          describe.skip(product !== 'Chromium')('[Chromium]', () => {
            require('./chromium/chromium.spec.js');
            require('./chromium/coverage.spec.js');
            require('./chromium/pdf.spec.js');
            require('./chromium/session.spec.js');
          });
        });

        // Browser-level tests that are given a browser.
        describe('[Driver]', () => {
          require('./browser.spec.js');
          require('./browsercontext.spec.js');
          require('./ignorehttpserrors.spec.js');
          require('./popup.spec.js');
        });
      });

      // Top-level tests that launch Browser themselves.
      describe('[Driver]', () => {
        require('./defaultbrowsercontext.spec.js');
        require('./fixtures.spec.js');
        require('./launcher.spec.js');
        require('./headful.spec.js');
        require('./multiclient.spec.js');
      });

      describe.skip(product !== 'Chromium')('[Chromium]', () => {
        require('./chromium/launcher.spec.js');
        require('./chromium/oopif.spec.js');
        require('./chromium/tracing.spec.js');
      });

      require('./apicoverage.spec.js');

      delete global.browserType;
      delete global.playwright;
    });
  }
};

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}
