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
const GoldenUtils = require('./golden-utils');
const {Matchers} = require('../utils/testrunner/');
const readline = require('readline');
const {TestServer} = require('../utils/testserver/');

const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

const BROWSER_CONFIGS = [
  {
    name: 'Firefox',
    events: {
      ...require('../lib/events').Events,
      ...require('../lib/chromium/events').Events,
    },
    missingCoverage: ['browserContext.setGeolocation', 'browserContext.setOffline', 'cDPSession.send', 'cDPSession.detach', 'page.emit("download")',
        'download.url', 'download.path', 'download.failure', 'download.createReadStream', 'download.delete'],
  },
  {
    name: 'WebKit',
    events: require('../lib/events').Events,
    missingCoverage: ['browserContext.clearPermissions', 'cDPSession.send', 'cDPSession.detach'],
  },
  {
    name: 'Chromium',
    events: require('../lib/events').Events,
    missingCoverage: [],
  },
];
const browserNames = BROWSER_CONFIGS.map(config => config.name);

/**
 * @type {TestSuite}
 */
module.exports.addPlaywrightTests = ({testRunner, platform, products, playwrightPath, headless, slowMo, dumpProtocolOnFailure, coverage}) => {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  const MAC = platform === 'darwin';
  const LINUX = platform === 'linux';
  const WIN = platform === 'win32';
  const playwright = require(playwrightPath);

  beforeAll(async state => {
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

  afterAll(async({server, sourceServer, httpsServer}) => {
    await Promise.all([
      server.stop(),
      httpsServer.stop(),
      sourceServer.stop(),
    ]);
  });

  beforeEach(async({server, httpsServer}) => {
    server.reset();
    httpsServer.reset();
  });

  for (const productInfo of products) {
    const product = productInfo.product;
    const browserType = playwright[product.toLowerCase()];
    const CHROMIUM = product === 'Chromium';
    const FFOX = product === 'Firefox';
    const WEBKIT = product === 'WebKit';
    const defaultBrowserOptions = {
      handleSIGINT: false,
      executablePath: productInfo.executablePath,
      slowMo,
      headless,
    };

    if (defaultBrowserOptions.executablePath) {
      console.warn(`${YELLOW_COLOR}WARN: running ${product} tests with ${defaultBrowserOptions.executablePath}${RESET_COLOR}`);
    } else {
      // Make sure the `npm install` was run after the chromium roll.
      if (!fs.existsSync(browserType.executablePath()))
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
      browserType,
      playwright,
      expect,
      defaultBrowserOptions,
      playwrightPath,
      headless: !!defaultBrowserOptions.headless,
      ASSETS_DIR,
    };

    function loadTests(modulePath) {
      const module = require(modulePath);
      if (typeof module.describe === 'function')
        describe('', module.describe, testOptions);
      if (typeof module.fdescribe === 'function')
        fdescribe('', module.fdescribe, testOptions);
      if (typeof module.xdescribe === 'function')
        xdescribe('', module.xdescribe, testOptions);
    }

    describe(product, () => {
      describe('', function() {
        beforeAll(async state => {
          state.browser = await browserType.launch(defaultBrowserOptions);
          state.browserServer = state.browser._ownedServer;
          state._stdout = readline.createInterface({ input: state.browserServer.process().stdout });
          state._stderr = readline.createInterface({ input: state.browserServer.process().stderr });
        });

        afterAll(async state => {
          await state.browserServer.close();
          state.browser = null;
          state.browserServer = null;
          state._stdout.close();
          state._stderr.close();
        });

        beforeEach(async(state, test) => {
          test.output = [];
          const dumpout = data => test.output.push(`\x1b[33m[pw:stdio:out]\x1b[0m ${data}`);
          const dumperr = data => test.output.push(`\x1b[31m[pw:stdio:err]\x1b[0m ${data}`);
          state._stdout.on('line', dumpout);
          state._stderr.on('line', dumperr);
          if (dumpProtocolOnFailure)
            state.browser._debugProtocol.log = data => test.output.push(`\x1b[32m[pw:protocol]\x1b[0m ${data}`);
          state.tearDown = async () => {
            state._stdout.off('line', dumpout);
            state._stderr.off('line', dumperr);
            if (dumpProtocolOnFailure)
              delete state.browser._debugProtocol.log;
          };
        });

        afterEach(async (state, test) => {
          if (state.browser.contexts().length !== 0) {
            if (test.result === 'ok')
              console.warn(`\nWARNING: test "${test.fullName()}" (${test.location()}) did not close all created contexts!\n`);
            await Promise.all(state.browser.contexts().map(context => context.close()));
          }
          await state.tearDown();
        });

        describe('', function() {
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
          describe('[Accessibility]', () => loadTests('./accessibility.spec.js'));
          describe('[Driver]', () => {
            loadTests('./autowaiting.spec.js');
            loadTests('./click.spec.js');
            loadTests('./cookies.spec.js');
            loadTests('./dialog.spec.js');
            loadTests('./download.spec.js');
            loadTests('./elementhandle.spec.js');
            loadTests('./emulation.spec.js');
            loadTests('./evaluation.spec.js');
            loadTests('./frame.spec.js');
            loadTests('./focus.spec.js');
            loadTests('./input.spec.js');
            loadTests('./jshandle.spec.js');
            loadTests('./keyboard.spec.js');
            loadTests('./mouse.spec.js');
            loadTests('./navigation.spec.js');
            loadTests('./network.spec.js');
            loadTests('./page.spec.js');
            loadTests('./queryselector.spec.js');
            loadTests('./screenshot.spec.js');
            loadTests('./waittask.spec.js');
            loadTests('./interception.spec.js');
            loadTests('./geolocation.spec.js');
            loadTests('./workers.spec.js');
            loadTests('./capabilities.spec.js');
          });
          describe('[Permissions]', () => {
            loadTests('./permissions.spec.js');
          });

          describe.skip(!CHROMIUM)('[Chromium]', () => {
            loadTests('./chromium/chromium.spec.js');
            loadTests('./chromium/coverage.spec.js');
            loadTests('./chromium/pdf.spec.js');
            loadTests('./chromium/session.spec.js');
          });
        });

        // Browser-level tests that are given a browser.
        describe('[Driver]', () => {
          loadTests('./browser.spec.js');
          loadTests('./browsercontext.spec.js');
          loadTests('./ignorehttpserrors.spec.js');
          loadTests('./popup.spec.js');
        });
      });

      // Top-level tests that launch Browser themselves.
      describe('[Driver]', () => {
        loadTests('./defaultbrowsercontext.spec.js');
        loadTests('./fixtures.spec.js');
        loadTests('./launcher.spec.js');
        loadTests('./headful.spec.js');
        loadTests('./multiclient.spec.js');
      });

      describe.skip(!CHROMIUM)('[Chromium]', () => {
        loadTests('./chromium/launcher.spec.js');
        loadTests('./chromium/oopif.spec.js');
        loadTests('./chromium/tracing.spec.js');
      });

      if (coverage) {
        const browserConfig = BROWSER_CONFIGS.find(config => config.name === product);
        const api = require('../lib/api');
        const filteredApi = {};
        Object.keys(api).forEach(apiName => {
          if (browserNames.some(browserName => apiName.startsWith(browserName)) && !apiName.startsWith(product))
            return;
          filteredApi[apiName] = api[apiName];
        });
        require('./utils').recordAPICoverage(testRunner, filteredApi, browserConfig.events, browserConfig.missingCoverage);
      }
    });
  }
};
