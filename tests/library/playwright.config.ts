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
import type { TestModeName } from '../config/testMode';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const getExecutablePath = (browserName: BrowserName) => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
};

const mode = (process.env.PWTEST_MODE ?? 'default') as TestModeName;
const headed = process.argv.includes('--headed');
const channel = process.env.PWTEST_CHANNEL as any;
const video = !!process.env.PWTEST_VIDEO;
const trace = !!process.env.PWTEST_TRACE;

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const reporters = () => {
  const result: ReporterDescription[] = process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { fileName: `${process.env.PWTEST_BOT_NAME}.zip` }],
  ] : [
    ['html', { open: 'on-failure', title: 'Playwright Library Tests' }]
  ];
  return result;
};

const os: 'linux' | 'windows' = (process.env.PLAYWRIGHT_SERVICE_OS as 'linux' | 'windows') || 'linux';
const runId = process.env.PLAYWRIGHT_SERVICE_RUN_ID || new Date().toISOString(); // name the test run

let connectOptions: any;
let webServer: Config['webServer'];

if (mode === 'service') {
  connectOptions = { wsEndpoint: 'ws://localhost:3333/' };
  webServer = {
    command: 'npx playwright run-server --port=3333',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
  };
}
if (mode === 'service2') {
  process.env.PW_VERSION_OVERRIDE = process.env.PW_VERSION_OVERRIDE || '1.39';
  connectOptions = {
    wsEndpoint: `${process.env.PLAYWRIGHT_SERVICE_URL}?cap=${JSON.stringify({ os, runId })}`,
    timeout: 3 * 60 * 1000,
    exposeNetwork: '<loopback>',
    headers: {
      'x-mpt-access-key': process.env.PLAYWRIGHT_SERVICE_ACCESS_KEY!
    }
  };
}

const config: Config<PlaywrightWorkerOptions & PlaywrightTestOptions & TestModeWorkerOptions> = {
  testDir,
  outputDir,
  expect: {
    timeout: 10000,
  },
  maxFailures: 200,
  timeout: video ? 60000 : 30000,
  globalTimeout: 5400000,
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  reporter: reporters(),
  projects: [],
  use: {
    connectOptions,
  },
  webServer,
};

const browserNames = ['chromium', 'webkit', 'firefox'] as BrowserName[];
for (const browserName of browserNames) {
  const executablePath = getExecutablePath(browserName);
  if (executablePath && !process.env.TEST_WORKER_INDEX)
    console.error(`Using executable at ${executablePath}`);
  const devtools = process.env.DEVTOOLS === '1';
  const testIgnore: RegExp[] = browserNames.filter(b => b !== browserName).map(b => new RegExp(b));

  const projectTemplate: typeof config.projects[0] = {
    testIgnore,
    snapshotPathTemplate: `{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-${browserName}{ext}`,
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
    },
    metadata: {
      platform: process.platform,
      docker: !!process.env.INSIDE_DOCKER,
      headless: headed ? 'headed' : 'headless',
      browserName,
      channel,
      mode,
      video: !!video,
      trace: !!trace,
      clock: process.env.PW_CLOCK ? 'clock-' + process.env.PW_CLOCK : undefined,
    }
  };

  config.projects.push({
    name: `${browserName}-library`,
    testDir: path.join(testDir, 'library'),
    ...projectTemplate,
  });

  config.projects.push({
    name: `${browserName}-page`,
    testDir: path.join(testDir, 'page'),
    ...projectTemplate,
  });
}

export default config;
