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
const inspector = require('inspector');

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
const MAJOR_NODEJS_VERSION = parseInt(process.version.substring(1).split('.')[0], 10);
if (MAJOR_NODEJS_VERSION >= 8 && inspector.url()) {
  console.log('Detected inspector - disabling timeout to be debugger-friendly');
  timeout = 0;
}

const testRunner = new TestRunner({
  timeout,
  parallel,
  breakOnFailure: process.argv.indexOf('--break-on-failure') !== -1,
  installCommonHelpers: false
});
testRunner.testModifier('skip', (t, condition) => condition && t.setSkipped(true));
testRunner.suiteModifier('skip', (s, condition) => condition && s.setSkipped(true));
testRunner.testModifier('fail', (t, condition) => condition && t.setExpectation(t.Expectations.Fail));
testRunner.suiteModifier('fail', (s, condition) => condition && s.setExpectation(s.Expectations.Fail));
testRunner.testModifier('slow', (t, condition) => condition && t.setTimeout(t.timeout() * 3));
testRunner.testModifier('repeat', (t, count) => t.setRepeat(count));
testRunner.suiteModifier('repeat', (s, count) => s.setRepeat(count));
testRunner.testAttribute('focus', t => t.setFocused(true));
testRunner.suiteAttribute('focus', s => s.setFocused(true));
testRunner.testAttribute('debug', t => {
  t.setFocused(true);
  t.setTimeout(100000000);

  let session;
  t.before(async () => {
    const util = require('util');
    const fs = require('fs');
    const url = require('url');
    const readFileAsync = util.promisify(fs.readFile.bind(fs));
    session = new inspector.Session();
    session.connect();
    const postAsync = util.promisify(session.post.bind(session));
    await postAsync('Debugger.enable');
    const setBreakpointCommands = [];
    const N = t.body().toString().split('\n').length;
    const location = t.location();
    const lines = (await readFileAsync(location.filePath, 'utf8')).split('\n');
    for (let line = 0; line < N; ++line) {
      const lineNumber = line + location.lineNumber;
      setBreakpointCommands.push(postAsync('Debugger.setBreakpointByUrl', {
        url: url.pathToFileURL(location.filePath),
        lineNumber,
        condition: `console.log('${String(lineNumber + 1).padStart(6, ' ')} | ' + ${JSON.stringify(lines[lineNumber])})`,
      }).catch(e => {}));
    }
    await Promise.all(setBreakpointCommands);
  });

  t.after(async () => {
    session.disconnect();
  });
});
testRunner.fdescribe = testRunner.describe.focus;
testRunner.xdescribe = testRunner.describe.skip(true);
testRunner.fit = testRunner.it.focus;
testRunner.xit = testRunner.it.skip(true);
testRunner.dit = testRunner.it.debug;

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

const BROWSER_CONFIGS = [
  {
    name: 'Firefox',
    events: {
      ...require('../lib/events').Events,
      ...require('../lib/chromium/events').Events,
    },
    missingCoverage: ['browserContext.setGeolocation', 'browserContext.setOffline', 'cDPSession.send', 'cDPSession.detach'],
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

for (const browserConfig of BROWSER_CONFIGS) {
  if (process.env.BROWSER !== browserConfig.name.toLowerCase() && process.env.BROWSER !== 'all')
    continue;
  const product = browserConfig.name;
  describe(product, () => {
    testRunner.describe('', require('./playwright.spec.js').describe, {
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

const filterArgIndex = process.argv.indexOf('--filter');
if (filterArgIndex !== -1) {
  const filter = process.argv[filterArgIndex + 1];
  testRunner.focusMatchingTests(new RegExp(filter, 'i'));
}

new Reporter(testRunner, {
  verbose: process.argv.includes('--verbose'),
  summary: !process.argv.includes('--verbose'),
  showSlowTests: process.env.CI ? 5 : 0,
  showMarkedAsFailingTests: 10,
});

// await utils.initializeFlakinessDashboardIfNeeded(testRunner);
testRunner.run({ totalTimeout: process.env.CI ? 15 * 60 * 1000 : 0 }).then(result => {
  process.exit(result.exitCode);
});

