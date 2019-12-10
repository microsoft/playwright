/**
 * Copyright 2017 Google Inc. All rights reserved.
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
const path = require('path');
const {TestServer} = require('../utils/testserver/');
const {TestRunner, Reporter} = require('../utils/testrunner/');
const utils = require('./utils');

let parallel = 1;
if (process.env.PPTR_PARALLEL_TESTS)
  parallel = parseInt(process.env.PPTR_PARALLEL_TESTS.trim(), 10);
const parallelArgIndex = process.argv.indexOf('-j');
if (parallelArgIndex !== -1)
  parallel = parseInt(process.argv[parallelArgIndex + 1], 10);
require('events').defaultMaxListeners *= parallel;

// Timeout to 20 seconds on Appveyor instances.
let timeout = process.env.APPVEYOR ? 20 * 1000 : 10 * 1000;
if (!isNaN(process.env.TIMEOUT))
  timeout = parseInt(process.env.TIMEOUT, 10);
const testRunner = new TestRunner({
  timeout,
  parallel,
  breakOnFailure: process.argv.indexOf('--break-on-failure') !== -1,
});
const {describe, fdescribe, beforeAll, afterAll, beforeEach, afterEach} = testRunner;

console.log('Testing on Node', process.version);

beforeAll(async state => {
  const assetsPath = path.join(__dirname, 'assets');
  const cachedPath = path.join(__dirname, 'assets', 'cached');

  const port = 8907 + state.parallelIndex * 2;
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
});

afterAll(async({server, httpsServer}) => {
  await Promise.all([
    server.stop(),
    httpsServer.stop(),
  ]);
});

beforeEach(async({server, httpsServer}) => {
  server.reset();
  httpsServer.reset();
});

if (process.env.BROWSER === 'firefox') {
  describe('Firefox', () => {
    require('./playwright.spec.js').addTests({
      product: 'Firefox',
      playwrightPath: path.join(utils.projectRoot(), 'firefox.js'),
      testRunner,
    });
  });
} else if (process.env.BROWSER === 'webkit') {
  describe('WebKit', () => {
    require('./playwright.spec.js').addTests({
      product: 'WebKit',
      playwrightPath: path.join(utils.projectRoot(), 'webkit.js'),
      testRunner,
    });
  });
} else {
  describe('Chromium', () => {
    require('./playwright.spec.js').addTests({
      product: 'Chromium',
      playwrightPath: path.join(utils.projectRoot(), 'chromium.js'),
      testRunner,
    });
    if (process.env.COVERAGE)
      utils.recordAPICoverage(testRunner, require('../lib/api').Chromium, require('../lib/chromium/events').Events);
  });
}

if (process.env.CI && testRunner.hasFocusedTestsOrSuites()) {
  console.error('ERROR: "focused" tests/suites are prohibitted on bots. Remove any "fit"/"fdescribe" declarations.');
  process.exit(1);
}

new Reporter(testRunner, {
  verbose: process.argv.includes('--verbose'),
  summary: !process.argv.includes('--verbose'),
  projectFolder: utils.projectRoot(),
  showSlowTests: process.env.CI ? 5 : 0,
});

(async() => {
  // await utils.initializeFlakinessDashboardIfNeeded(testRunner);
  testRunner.run();
})();

