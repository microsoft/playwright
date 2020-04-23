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
const {TestServer} = require('../utils/testserver/');
const {Environment} = require('../utils/testrunner/Test');

const playwrightPath = path.join(__dirname, '..');

const serverEnvironment = new Environment('TestServer');
serverEnvironment.beforeAll(async state => {
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

  state.defaultBrowserOptions = {
    handleSIGINT: false,
    slowMo: valueFromEnv('SLOW_MO', 0),
    headless: !!valueFromEnv('HEADLESS', true),
  };
  state.playwrightPath = playwrightPath;
});
serverEnvironment.afterAll(async({server, httpsServer}) => {
  await Promise.all([
    server.stop(),
    httpsServer.stop(),
  ]);
});
serverEnvironment.beforeEach(async({server, httpsServer}) => {
  server.reset();
  httpsServer.reset();
});

const customEnvironment = new Environment('Golden+CheckContexts');
customEnvironment.beforeAll(async state => {
  const { OUTPUT_DIR, GOLDEN_DIR } = require('./utils').testOptions(state.browserType);
  if (fs.existsSync(OUTPUT_DIR))
    rm(OUTPUT_DIR);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  state.golden = goldenName => ({ goldenPath: GOLDEN_DIR, outputPath: OUTPUT_DIR, goldenName });
});
customEnvironment.afterAll(async state => {
  delete state.golden;
});
customEnvironment.afterEach(async (state, testRun) => {
  if (state.browser && state.browser.contexts().length !== 0) {
    if (testRun.ok())
      console.warn(`\nWARNING: test "${testRun.test().fullName()}" (${testRun.test().location()}) did not close all created contexts!\n`);
    await Promise.all(state.browser.contexts().map(context => context.close()));
  }
});

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}

function setupTestRunner(testRunner) {
  const collector = testRunner.collector();
  collector.addTestModifier('skip', (t, condition) => condition && t.setSkipped(true));
  collector.addSuiteModifier('skip', (s, condition) => condition && s.setSkipped(true));
  collector.addTestModifier('fail', (t, condition) => condition && t.setExpectation(t.Expectations.Fail));
  collector.addSuiteModifier('fail', (s, condition) => condition && s.setExpectation(s.Expectations.Fail));
  collector.addTestModifier('slow', t => t.setTimeout(t.timeout() * 3));
  collector.addTestAttribute('debug', t => {
    t.setTimeout(100000000);

    let session;
    t.environment().beforeEach(async () => {
      const inspector = require('inspector');
      const fs = require('fs');
      const util = require('util');
      const url = require('url');
      const readFileAsync = util.promisify(fs.readFile.bind(fs));
      session = new inspector.Session();
      session.connect();
      const postAsync = util.promisify(session.post.bind(session));
      await postAsync('Debugger.enable');
      const setBreakpointCommands = [];
      const N = t.body().toString().split('\n').length;
      const location = t.location();
      const lines = (await readFileAsync(location.filePath(), 'utf8')).split('\n');
      for (let line = 0; line < N; ++line) {
        const lineNumber = line + location.lineNumber();
        setBreakpointCommands.push(postAsync('Debugger.setBreakpointByUrl', {
          url: url.pathToFileURL(location.filePath()),
          lineNumber,
          condition: `console.log('${String(lineNumber + 1).padStart(6, ' ')} | ' + ${JSON.stringify(lines[lineNumber])})`,
        }).catch(e => {}));
      }
      await Promise.all(setBreakpointCommands);
    });

    t.environment().afterEach(async () => {
      session.disconnect();
    });
  });
  testRunner.api().fdescribe = testRunner.api().describe.only;
  testRunner.api().xdescribe = testRunner.api().describe.skip(true);
  testRunner.api().fit = testRunner.api().it.only;
  testRunner.api().xit = testRunner.api().it.skip(true);
  testRunner.api().dit = testRunner.api().it.only.debug;
}

module.exports = {
  playwrightPath,
  dumpProtocolOnFailure: valueFromEnv('DEBUGP', false),
  launchOptions: {
    executablePath: {
      chromium: process.env.CRPATH,
      firefox: process.env.FFPATH,
      webkit: process.env.WKPATH,
    },
    slowMo: valueFromEnv('SLOW_MO', 0),
    headless: !!valueFromEnv('HEADLESS', true),
  },

  globalEnvironments: [serverEnvironment],
  setupTestRunner,

  specs: [
    {
      files: [
        './accessibility.spec.js',
        './autowaiting.spec.js',
        './click.spec.js',
        './cookies.spec.js',
        './dialog.spec.js',
        './dispatchevent.spec.js',
        './download.spec.js',
        './elementhandle.spec.js',
        './emulation.spec.js',
        './evaluation.spec.js',
        './frame.spec.js',
        './focus.spec.js',
        './input.spec.js',
        './jshandle.spec.js',
        './keyboard.spec.js',
        './mouse.spec.js',
        './navigation.spec.js',
        './network.spec.js',
        './page.spec.js',
        './queryselector.spec.js',
        './screenshot.spec.js',
        './waittask.spec.js',
        './interception.spec.js',
        './geolocation.spec.js',
        './workers.spec.js',
        './capabilities.spec.js',
        './permissions.spec.js',
      ],
      environments: [customEnvironment,  'page'],
    },

    {
      files: [
        './chromium/chromium.spec.js',
        './chromium/coverage.spec.js',
        './chromium/pdf.spec.js',
        './chromium/session.spec.js',
      ],
      browsers: ['chromium'],
      title: '[Chromium]',
      environments: [customEnvironment, 'page'],
    },

    {
      files: [
        './browser.spec.js',
        './browsercontext.spec.js',
        './ignorehttpserrors.spec.js',
        './popup.spec.js',
      ],
      environments: [customEnvironment, 'browser'],
    },

    {
      files: [
        './defaultbrowsercontext.spec.js',
        './fixtures.spec.js',
        './launcher.spec.js',
        './logger.spec.js',
        './headful.spec.js',
        './multiclient.spec.js',
      ],
      environments: [customEnvironment],
    },

    {
      files: [
        './chromium/launcher.spec.js',
        './chromium/oopif.spec.js',
        './chromium/tracing.spec.js',
      ],
      browsers: ['chromium'],
      title: '[Chromium]',
      environments: [customEnvironment],
    },

    {
      files: [
        './apicoverage.spec.js',
      ],
      environments: [],
    },
  ],
};
