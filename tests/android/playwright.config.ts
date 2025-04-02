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

const use: typeof config.projects[0]['use'] = {
  sameOriginHost: '10.0.2.2',
  // sslip.io is a free service that provides wildcard DNS for any IP address.
  // It allows us to use a domain name that resolves to the local machine's IP address.
  // Modifying /etc/hosts is not necessary by that and would be hard.
  crossOriginHost: '10.0.2.2.sslip.io',
  browserName: 'chromium',
};

config.projects!.push({
  name: 'android-native',
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-android{ext}',
  testDir: path.join(testDir, 'android'),
  metadata,
  use,
});

config.projects!.push({
  name: 'android-page',
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-android{ext}',
  testDir: path.join(testDir, 'page'),
  metadata,
  use,
});

export default config;
