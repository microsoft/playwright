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

const products = ['WebKit', 'Firefox', 'Chromium'];
let product;
let events;
let missingCoverage;
if (process.env.BROWSER === 'firefox') {
  product = 'Firefox';
  events = {
    ...require('../lib/events').Events,
    ...require('../lib/chromium/events').Events,
  };
  missingCoverage = ['browserContext.setGeolocation', 'elementHandle.scrollIntoViewIfNeeded', 'page.setOfflineMode'];
} else if (process.env.BROWSER === 'webkit') {
  product = 'WebKit';
  events = require('../lib/events').Events;
  missingCoverage = ['browserContext.clearPermissions'];
} else {
  product = 'Chromium';
  events = require('../lib/events').Events;
  missingCoverage = [];
}

describe(product, () => {
  testRunner.loadTests(require('./playwright.spec.js'), {
    product,
    playwrightPath: utils.projectRoot(),
    testRunner,
  });
  if (process.env.COVERAGE) {
    const api = require('../lib/api');
    const filteredApi = {};
    Object.keys(api).forEach(name => {
      if (products.some(p => name.startsWith(p)) && !name.startsWith(product))
        return;
      filteredApi[name] = api[name];
    });
    utils.recordAPICoverage(testRunner, filteredApi, events, missingCoverage);
  }
});

if (process.env.CI && testRunner.hasFocusedTestsOrSuites()) {
  console.error('ERROR: "focused" tests/suites are prohibitted on bots. Remove any "fit"/"fdescribe" declarations.');
  process.exit(1);
}

new Reporter(testRunner, {
  verbose: process.argv.includes('--verbose'),
  summary: !process.argv.includes('--verbose'),
  showSlowTests: process.env.CI ? 5 : 0,
  showSkippedTests: 10,
});

// await utils.initializeFlakinessDashboardIfNeeded(testRunner);
testRunner.run().then(result => {
  process.exit(result.exitCode);
});

