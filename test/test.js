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
if (process.env.PW_PARALLEL_TESTS)
  parallel = parseInt(process.env.PW_PARALLEL_TESTS.trim(), 10);
const parallelArgIndex = process.argv.indexOf('-j');
if (parallelArgIndex !== -1)
  parallel = parseInt(process.argv[parallelArgIndex + 1], 10);
require('events').defaultMaxListeners *= parallel;

let timeout = process.env.CI ? 30 * 1000 : 10 * 1000;
if (!isNaN(process.env.TIMEOUT))
  timeout = parseInt(process.env.TIMEOUT * 1000, 10);
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

const BROWSER_CONFIGS = [
  {
    name: 'Firefox',
    events: {
      ...require('../lib/events').Events,
      ...require('../lib/chromium/events').Events,
    },
    missingCoverage: ['browserContext.setGeolocation', 'browserContext.setOffline', 'worker.url'],
  },
  {
    name: 'WebKit',
    events: require('../lib/events').Events,
    missingCoverage: ['browserContext.clearPermissions'],
  },
  {
    name: 'Chromium',
    events: require('../lib/events').Events,
    missingCoverage: [],
  },
];

const browserNames = BROWSER_CONFIGS.map(config => config.name);

for (const browserConfig of BROWSER_CONFIGS) {
  if (process.env.BROWSER !== browserConfig.name.toLowerCase() && process.env.BROWSER !== 'all')
    continue;
  const product = browserConfig.name;
  describe(product, () => {
    testRunner.loadTests(require('./playwright.spec.js'), {
      product,
      playwrightPath: utils.projectRoot(),
      testRunner,
    });
    if (process.env.COVERAGE) {
      const api = require('../lib/api');
      const filteredApi = {};
      Object.keys(api).forEach(apiName => {
        if (browserNames.some(browserName => apiName.startsWith(browserName)) && !apiName.startsWith(product))
          return;
        filteredApi[apiName] = api[apiName];
      });
      utils.recordAPICoverage(testRunner, filteredApi, browserConfig.events, browserConfig.missingCoverage);
    }
  });
}

if (process.env.CI && testRunner.hasFocusedTestsOrSuites()) {
  console.error('ERROR: "focused" tests/suites are prohibited on bots. Remove any "fit"/"fdescribe" declarations.');
  process.exit(1);
}

new Reporter(testRunner, {
  verbose: process.argv.includes('--verbose'),
  summary: !process.argv.includes('--verbose'),
  showSlowTests: process.env.CI ? 5 : 0,
  showMarkedAsFailingTests: 10,
});

// await utils.initializeFlakinessDashboardIfNeeded(testRunner);
testRunner.run().then(result => {
  process.exit(result.exitCode);
});

