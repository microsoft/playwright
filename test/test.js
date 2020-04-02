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

const {TestRunner, Reporter} = require('../utils/testrunner/');
const utils = require('./utils');
const os = require('os');

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
if (MAJOR_NODEJS_VERSION >= 8 && require('inspector').url()) {
  console.log('Detected inspector - disabling timeout to be debugger-friendly');
  timeout = 0;
}

const testRunner = new TestRunner({
  timeout,
  parallel,
  breakOnFailure: process.argv.indexOf('--break-on-failure') !== -1,
  installCommonHelpers: false
});
utils.setupTestRunner(testRunner);

console.log('Testing on Node', process.version);

const names = ['Chromium', 'Firefox', 'WebKit'].filter(name => {
  return process.env.BROWSER === name.toLowerCase() || process.env.BROWSER === 'all';
});
const products = names.map(name => {
  const executablePath = {
    'Chromium': process.env.CRPATH,
    'Firefox': process.env.FFPATH,
    'WebKit': process.env.WKPATH,
  }[name];
  return { product: name, executablePath };
});

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}

require('./playwright.spec.js').addPlaywrightTests({
  playwrightPath: utils.projectRoot(),
  products,
  platform: os.platform(),
  testRunner,
  headless: !!valueFromEnv('HEADLESS', true),
  slowMo: valueFromEnv('SLOW_MO', 0),
  dumpProtocolOnFailure: valueFromEnv('DEBUGP', false),
  coverage: process.env.COVERAGE,
});

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

