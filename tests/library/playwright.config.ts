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
import type { TestModeWorkerOptions } from '../config/testModeFixtures';
import type { TestModeName } from '../config/testMode';
import type { CoverageWorkerOptions } from '../config/coverageFixtures';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const getExecutablePath = (browserName: BrowserName) => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
};

const mode: TestModeName = (process.env.PWTEST_MODE ?? 'default') as ('default' | 'driver' | 'service');
const headed = process.argv.includes('--headed');
const channel = process.env.PWTEST_CHANNEL as any;
const video = !!process.env.PWTEST_VIDEO;
const trace = !!process.env.PWTEST_TRACE;

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: Config<CoverageWorkerOptions & PlaywrightWorkerOptions & PlaywrightTestOptions & TestModeWorkerOptions> = {
  testDir,
  outputDir,
  expect: {
    timeout: 10000,
    toHaveScreenshot: { _comparator: 'ssim-cie94' } as any,
    toMatchSnapshot: { _comparator: 'ssim-cie94' } as any,
  },
  maxFailures: 100,
  timeout: video ? 60000 : 30000,
  globalTimeout: 5400000,
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  preserveOutput: process.env.CI ? 'failures-only' : 'always',
  retries: process.env.CI ? 3 : 0,
  reporter: process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
  ] : [
    ['html', { open: 'on-failure' }]
  ],
  projects: [],
  use: {
    connectOptions: mode === 'service' ? {
      wsEndpoint: 'ws://localhost:3333/',
    } : undefined,
  },
  webServer: mode === 'service' ? {
    command: 'npx playwright run-server --port=3333',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
  } : undefined,
};

const browserNames = ['chromium', 'webkit', 'firefox'] as BrowserName[];
for (const browserName of browserNames) {
  const executablePath = getExecutablePath(browserName);
  if (executablePath && !process.env.TEST_WORKER_INDEX)
    console.error(`Using executable at ${executablePath}`);
  const devtools = process.env.DEVTOOLS === '1';
  const testIgnore: RegExp[] = browserNames.filter(b => b !== browserName).map(b => new RegExp(b));
  for (const folder of ['library', 'page']) {
    config.projects.push({
      name: browserName,
      testDir: path.join(testDir, folder),
      testIgnore,
      snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
      use: {
        mode,
        browserName,
        headless: !headed,
        channel,
        video: video ? 'on' : undefined,
        launchOptions: {
          executablePath,
          devtools
        },
        trace: trace ? 'on' : undefined,
        coverageName: browserName,
      },
      metadata: {
        platform: process.platform,
        docker: !!process.env.INSIDE_DOCKER,
        headful: !!headed,
        browserName,
        channel,
        mode,
        video: !!video,
        trace: !!trace,
      },
    });
  }
}

export default config;
