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
loadEnv({ path: path.join(__dirname, '..', '..', '.env') });
process.env.PWTEST_UNDER_TEST = '1';

import type { Config, PlaywrightTestOptions, PlaywrightWorkerOptions } from '@playwright/test';
import * as path from 'path';
import type { ServerWorkerOptions } from '../config/serverFixtures';

process.env.PWPAGE_IMPL = 'android';

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: Config<ServerWorkerOptions & PlaywrightWorkerOptions & PlaywrightTestOptions> = {
  testDir,
  outputDir,
  timeout: 120000,
  globalTimeout: 7200000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
  ] : 'line',
  projects: [],
};

const metadata = {
  platform: 'Android',
  headless: 'headless',
  browserName: 'chromium',
  channel: 'chrome',
  mode: 'default',
  video: false,
};

config.projects!.push({
  name: 'android-native',
  use: {
    loopback: '10.0.2.2',
    browserName: 'chromium',
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-android{ext}',
  testDir: path.join(testDir, 'android'),
  metadata,
});

config.projects!.push({
  name: 'android-page',
  use: {
    loopback: '10.0.2.2',
    browserName: 'chromium',
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-android{ext}',
  testDir: path.join(testDir, 'page'),
  metadata,
});

export default config;
