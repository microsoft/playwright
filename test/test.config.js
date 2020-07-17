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

const path = require('path');
const utils = require('./utils');
const {DefaultBrowserOptionsEnvironment, ServerEnvironment, GoldenEnvironment, TraceTestEnvironment} = require('./environments.js');

const playwrightPath = path.join(__dirname, '..');

const dumpLogOnFailure = valueFromEnv('DEBUGP', false);
const defaultBrowserOptionsEnvironment = new DefaultBrowserOptionsEnvironment({
  handleSIGINT: false,
  slowMo: valueFromEnv('SLOW_MO', 0),
  headless: !!valueFromEnv('HEADLESS', true),
}, dumpLogOnFailure, playwrightPath);

const serverEnvironment = new ServerEnvironment();
const customEnvironment = new GoldenEnvironment();

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
  collector.addTestAttribute('debug', t => TraceTestEnvironment.enableForTest(t));
  testRunner.api().fdescribe = testRunner.api().describe.only;
  testRunner.api().xdescribe = testRunner.api().describe.skip(true);
  testRunner.api().fit = testRunner.api().it.only;
  testRunner.api().xit = testRunner.api().it.skip(true);
  testRunner.api().dit = testRunner.api().it.only.debug;
}

module.exports = {
  playwrightPath,
  dumpLogOnFailure: valueFromEnv('DEBUGP', false),
  launchOptions: {
    executablePath: {
      chromium: process.env.CRPATH,
      firefox: process.env.FFPATH,
      webkit: process.env.WKPATH,
    },
    slowMo: valueFromEnv('SLOW_MO', 0),
    headless: !!valueFromEnv('HEADLESS', true),
  },

  globalEnvironments: [defaultBrowserOptionsEnvironment, serverEnvironment],
  setupTestRunner,

  specs: [
    {
      files: [
        './input.spec.js',
        './jshandle.spec.js',
        './keyboard.spec.ts',
        './mouse.spec.js',
        './navigation.spec.js',
        './pdf.spec.js',
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
        './chromium/session.spec.js',
      ],
      browsers: ['chromium'],
      title: '[Chromium]',
      environments: [customEnvironment, 'page'],
    },

    {
      files: [
        './defaultbrowsercontext.spec.js',
        './downloadsPath.spec.js',
        './fixtures.spec.js',
        './launcher.spec.js',
        './logger.spec.js',
        './headful.spec.js',
        './multiclient.spec.js',
        './proxy.spec.js',
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
        './firefox/launcher.spec.js',
      ],
      browsers: ['firefox'],
      title: '[Firefox]',
      environments: [customEnvironment],
    },

    {
      files: [
        './electron/electron.spec.js',
      ],
      browsers: ['chromium'],
      title: '[Electron]',
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
