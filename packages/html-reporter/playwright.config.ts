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

import path from 'path';
import type { PlaywrightTestConfig } from '@playwright/experimental-ct-react';
import { devices } from '@playwright/experimental-ct-react';

const config: PlaywrightTestConfig = {
  testDir: 'src',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    vitePort: 3101,
    trace: 'on-first-retry',
  },
  projects: [ ],
};

if (process.env.REBASE) {
  require('dotenv').config({
    path: path.join(__dirname, '.env'),
  });

  if (!process.env.TEST_WORKER_INDEX) {
    // eslint-disable-next-line no-console
    console.log(`Running against service: ${process.env.SERVICE_URL}`);
  }

  config.timeout = 600000;
  const configurations = [
    { os: 'windows', platform: 'win32' },
    { os: 'linux', platform: 'linux' },
    { os: 'macos', platform: 'darwin' },
  ];
  for (const { os, platform } of configurations) {
    config.projects.push({
      name: `service-${platform}`,
      _screenshotsDir: `./__screenshots__/${platform}/chromium`,
      use: {
        ...devices['Desktop Chrome'],
        connectOptions: {
          timeout: 600000,
          wsEndpoint: process.env.SERVICE_URL + `?os=${os}`,
        },
      },
    });
  }
} else {
  config.projects = [
    {
      name: 'chromium',
      _screenshotsDir: `./__screenshots__/${process.platform}/chromium`,
      use: { ...devices['Desktop Chrome'] },
    },
  ];
}

export default config;
