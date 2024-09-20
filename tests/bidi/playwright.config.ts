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

import { type Config, type PlaywrightTestOptions, type PlaywrightWorkerOptions, type ReporterDescription } from '@playwright/test';
import * as path from 'path';
import type { TestModeWorkerOptions } from '../config/testModeFixtures';

const getExecutablePath = () => {
  return process.env.BIDIPATH;
};

const headed = process.argv.includes('--headed');
const trace = !!process.env.PWTEST_TRACE;

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const reporters = () => {
  const result: ReporterDescription[] = process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { fileName: `${process.env.PWTEST_BOT_NAME}.zip` }],
  ] : [
    ['html', { open: 'on-failure' }],
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
  globalTimeout: 30 * 60 * 1000,
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  reporter: reporters(),
  projects: [],
};

const executablePath = getExecutablePath();
if (executablePath && !process.env.TEST_WORKER_INDEX)
  console.error(`Using executable at ${executablePath}`);
const testIgnore: RegExp[] = [];
const browserToChannels = {
  '_bidiChromium': ['bidi-chromium', 'bidi-chrome-canary', 'bidi-chrome-stable'],
  '_bidiFirefox': ['bidi-firefox-nightly', 'bidi-firefox-beta', 'bidi-firefox-stable'],
};
for (const [key, channels] of Object.entries(browserToChannels)) {
  const browserName: any = key;
  for (const channel of channels) {
    for (const folder of ['library', 'page']) {
      config.projects.push({
        name: `${channel}-${folder}`,
        testDir: path.join(testDir, folder),
        testIgnore,
        snapshotPathTemplate: `{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-${channel}{ext}`,
        use: {
          browserName,
          headless: !headed,
          channel,
          video: 'off',
          launchOptions: {
            executablePath,
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
