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

import { config as loadEnv } from 'dotenv';
loadEnv({ path: path.join(__dirname, '..', '..', '.env'), override: true });
process.env.PWTEST_UNDER_TEST = '1';

import { type Config, type PlaywrightTestOptions, type PlaywrightWorkerOptions, type ReporterDescription } from '@playwright/test';
import * as path from 'path';
import type { TestModeWorkerOptions } from '../config/testModeFixtures';

const headed = process.argv.includes('--headed');
const trace = !!process.env.PWTEST_TRACE;
const hasDebugOutput = process.env.DEBUG?.includes('pw:');

function firefoxUserPrefs() {
  const prefsString = process.env.PWTEST_FIREFOX_USER_PREFS;
  if (!prefsString)
    return undefined;
  return JSON.parse(prefsString);
}

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const reporters = () => {
  const result: ReporterDescription[] = process.env.CI ? [
    hasDebugOutput ? ['list'] : ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { fileName: `${process.env.PWTEST_BOT_NAME}.zip` }],
    ['./csvReporter', { outputFile: path.join(outputDir, 'report.csv') }],
  ] : [
    ['html', { open: 'on-failure' }],
    ['./csvReporter', { outputFile: path.join(outputDir, 'report.csv') }],
    ['./expectationReporter', { rebase: false }],
  ];
  return result;
};

const config: Config<PlaywrightWorkerOptions & PlaywrightTestOptions & TestModeWorkerOptions> = {
  testDir,
  outputDir,
  expect: {
    timeout: 10000,
  },
  maxFailures: 0,
  timeout: 15 * 1000,
  globalTimeout: 90 * 60 * 1000,
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries even on CI for now.
  reporter: reporters(),
  projects: [],
};

type BrowserName = '_bidiChromium' | '_bidiFirefox';

const getExecutablePath = (browserName: BrowserName) => {
  if (browserName === '_bidiChromium')
    return process.env.BIDI_CRPATH;
  if (browserName === '_bidiFirefox')
    return process.env.BIDI_FFPATH;
};

const browserToChannels = {
  '_bidiChromium': ['bidi-chromium', 'bidi-chrome-canary', 'bidi-chrome-stable'],
  '_bidiFirefox': ['moz-firefox'],
};

for (const [key, channels] of Object.entries(browserToChannels)) {
  const browserName: any = key;
  const executablePath = getExecutablePath(browserName);
  if (executablePath && !process.env.TEST_WORKER_INDEX)
    console.error(`Using executable at ${executablePath}`);
  for (const channel of channels) {
    const testIgnore: RegExp[] = [
      /library\/debug-controller/,
      /library\/inspector/,
      /library\/trace-viewer.spec.ts/,
      /library\/tracing.spec.ts/,
      /page\/page-leaks.spec.ts/,
    ];
    if (browserName.toLowerCase().includes('firefox'))
      testIgnore.push(/chromium/);
    if (browserName.toLowerCase().includes('chromium'))
      testIgnore.push(/firefox/);
    for (const folder of ['library', 'page']) {
      config.projects.push({
        name: `${channel}-${folder}`,
        testDir: path.join(testDir, folder),
        testIgnore,
        snapshotPathTemplate: `{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-${channel}{ext}`,
        use: {
          browserName,
          headless: !headed,
          channel: channel === 'bidi-chromium' ? undefined : channel,
          video: 'off',
          launchOptions: {
            executablePath,
            firefoxUserPrefs: firefoxUserPrefs(),
          },
          trace: trace ? 'on' : undefined,
        },
        metadata: {
          platform: process.platform,
          docker: !!process.env.INSIDE_DOCKER,
          headless: !headed,
          browserName,
          channel,
          trace: !!trace,
        },
      });
    }
  }
}

export default config;
