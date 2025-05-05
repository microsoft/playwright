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

process.env.PWPAGE_IMPL = 'electron';

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: Config<PlaywrightWorkerOptions & PlaywrightTestOptions> = {
  testDir,
  outputDir,
  timeout: 30000,
  globalTimeout: 5400000,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  reporter: process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    // Needed since tests/electron/package.json exists which would otherwise be picked up as tests/electron/ (outputDir)
    ['blob', { fileName: path.join(__dirname, '../../blob-report/', `${process.env.PWTEST_BOT_NAME}.zip`) }],
  ] : 'line',
  projects: [],
  globalSetup: './globalSetup.ts'
};

const metadata = {
  platform: process.platform,
  headless: 'headed',
  browserName: 'electron',
  channel: undefined,
  mode: 'default',
  video: false,
};

config.projects.push({
  name: 'electron-api',
  use: {
    browserName: 'chromium',
    headless: false,
  },
  testDir: path.join(testDir, 'electron'),
  metadata,
});

config.projects.push({
  name: 'electron-page',
  // Share screenshots with chromium.
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium{ext}',
  use: {
    browserName: 'chromium',
    headless: false,
  },
  testDir: path.join(testDir, 'page'),
  metadata,
});

export default config;
