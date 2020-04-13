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

const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');
const removeFolder = require('rimraf');

const {FlakinessDashboard} = require('../utils/flakiness-dashboard');
const PROJECT_ROOT = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');

const mkdtempAsync = util.promisify(require('fs').mkdtemp);
const removeFolderAsync = util.promisify(removeFolder);

let platform = os.platform();

const utils = module.exports = {
  /**
   * @return {string}
   */
  projectRoot: function() {
    return PROJECT_ROOT;
  },

  /**
   * @param {!Page} page
   * @param {string} frameId
   * @param {string} url
   * @return {!Playwright.Frame}
   */
  attachFrame: async function(page, frameId, url) {
    const handle = await page.evaluateHandle(async ({ frameId, url }) => {
      const frame = document.createElement('iframe');
      frame.src = url;
      frame.id = frameId;
      document.body.appendChild(frame);
      await new Promise(x => frame.onload = x);
      return frame;
    }, { frameId, url });
    return handle.asElement().contentFrame();
  },

  /**
   * @param {!Page} page
   * @param {string} frameId
   */
  detachFrame: async function(page, frameId) {
    await page.evaluate(frameId => {
      document.getElementById(frameId).remove();
    }, frameId);
  },

  /**
   * @param {!Frame} frame
   * @param {string=} indentation
   * @return {Array<string>}
   */
  dumpFrames: function(frame, indentation) {
    indentation = indentation || '';
    let description = frame.url().replace(/:\d{4}\//, ':<PORT>/');
    if (frame.name())
      description += ' (' + frame.name() + ')';
    const result = [indentation + description];
    const childFrames = frame.childFrames();
    childFrames.sort((a, b) => {
      if (a.url() !== b.url())
        return a.url() < b.url() ? -1 : 1;
      return a.name() < b.name() ? -1 : 1;
    });
    for (const child of childFrames)
      result.push(...utils.dumpFrames(child, '    ' + indentation));
    return result;
  },

  initializeFlakinessDashboardIfNeeded: async function(testRunner) {
    // Generate testIDs for all tests and verify they don't clash.
    // This will add |test.testId| for every test.
    //
    // NOTE: we do this on CI's so that problems arise on PR trybots.
    if (process.env.CI)
      generateTestIDs(testRunner);
    // FLAKINESS_DASHBOARD_PASSWORD is an encrypted/secured variable.
    // Encrypted variables get a special treatment in CI's when handling PRs so that
    // secrets are not leaked to untrusted code.
    // - AppVeyor DOES NOT decrypt secured variables for PRs
    // - Travis DOES NOT decrypt encrypted variables for PRs
    // - Cirrus CI DOES NOT decrypt encrypted variables for PRs *unless* PR is sent
    //   from someone who has WRITE ACCESS to the repo.
    //
    // Since we don't want to run flakiness dashboard for PRs on all CIs, we
    // check existence of FLAKINESS_DASHBOARD_PASSWORD and absence of
    // CIRRUS_BASE_SHA env variables.
    if (!process.env.FLAKINESS_DASHBOARD_PASSWORD || process.env.CIRRUS_BASE_SHA)
      return;
    const {sha, timestamp} = await FlakinessDashboard.getCommitDetails(__dirname, 'HEAD');
    const dashboard = new FlakinessDashboard({
      commit: {
        sha,
        timestamp,
        url: `https://github.com/Microsoft/playwright/commit/${sha}`,
      },
      build: {
        url: process.env.FLAKINESS_DASHBOARD_BUILD_URL,
      },
      dashboardRepo: {
        url: 'https://github.com/aslushnikov/playwright-flakiness-dashboard.git',
        username: 'playwright-flakiness',
        email: 'aslushnikov+playwrightflakiness@gmail.com',
        password: process.env.FLAKINESS_DASHBOARD_PASSWORD,
        branch: process.env.FLAKINESS_DASHBOARD_NAME,
      },
    });

    testRunner.on('testfinished', test => {
      // Do not report tests from COVERAGE testsuite.
      // They don't bring much value to us.
      if (test.fullName.includes('**API COVERAGE**'))
        return;
      const testpath = test.location.filePath.substring(utils.projectRoot().length);
      const url = `https://github.com/Microsoft/playwright/blob/${sha}/${testpath}#L${test.location.lineNumber}`;
      dashboard.reportTestResult({
        testId: test.testId,
        name: test.location().toString(),
        description: test.fullName(),
        url,
        result: test.result,
      });
    });
    testRunner.on('finished', async({result}) => {
      dashboard.setBuildResult(result);
      await dashboard.uploadAndCleanup();
    });

    function generateTestIDs(testRunner) {
      const testIds = new Map();
      for (const test of testRunner.tests()) {
        const testIdComponents = [test.name];
        for (let suite = test.suite; !!suite.parentSuite; suite = suite.parentSuite)
          testIdComponents.push(suite.name);
        testIdComponents.reverse();
        const testId = testIdComponents.join('>');
        const clashingTest = testIds.get(testId);
        if (clashingTest)
          throw new Error(`Two tests with clashing IDs: ${test.location()} and ${clashingTest.location()}`);
        testIds.set(testId, test);
        test.testId = testId;
      }
    }
  },

  makeUserDataDir: async function() {
    return await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_profile-'));
  },

  removeUserDataDir: async function(dir) {
    await removeFolderAsync(dir).catch(e => {});
  },

  testOptions(browserType) {
    const GOLDEN_DIR = path.join(__dirname, 'golden-' + browserType.name());
    const OUTPUT_DIR = path.join(__dirname, 'output-' + browserType.name());
    return {
      FFOX: browserType.name() === 'firefox',
      WEBKIT: browserType.name() === 'webkit',
      CHROMIUM: browserType.name() === 'chromium',
      MAC: platform === 'darwin',
      LINUX: platform === 'linux',
      WIN: platform === 'win32',
      browserType,
      GOLDEN_DIR,
      OUTPUT_DIR,
    };
  },

  setPlatform(p) {
    // To support isplaywrightready.
    platform = p;
  },
};

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}
