/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');
const { fixturesUI, fixturePool } = require('./fixturesUI');
const dot = require('./dot');
const { Matchers } = require('../../utils/testrunner/Matchers');

const browserName = process.env.BROWSER || 'chromium';
const goldenPath = path.join(__dirname, '..', 'golden-' + browserName);
const outputPath = path.join(__dirname, '..', 'output-' + browserName);
global.expect = new Matchers({ goldenPath, outputPath }).expect;
global.testOptions = require('../harness/testOptions');

const mocha = new Mocha({
	ui: fixturesUI,
	reporter: dot,
	timeout: 10000,
});
const testDir = path.join(process.cwd(), 'test');

const filter = process.argv[2];

fs.readdirSync(testDir).filter(function(file) {
  return file.includes('.spec.') && (!filter || file.includes(filter));
}).forEach(function(file) {
  mocha.addFile(path.join(testDir, file));
});

const runner = mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});
const constants = Mocha.Runner.constants;
runner.on(constants.EVENT_RUN_END, test => {
  fixturePool.teardownScope('worker');
});
