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

import { setConfig, Config } from '../folio/out';
import * as path from 'path';
import { test as playwrightTest, slowTest as playwrightSlowTest } from './playwrightTest';
import { test as browserTest } from './browserTest';
import { test as pageTest } from './pageTest';
import { PlaywrightEnv, BrowserEnv, PageEnv, BrowserName } from './browserEnv';
import { ServerEnv } from './serverEnv';

const config: Config = {
  testDir: path.join(__dirname, '..'),
  timeout: process.env.PWVIDEO ? 60000 : 30000,
  globalTimeout: 5400000,
};
if (process.env.CI) {
  config.workers = 1;
  config.forbidOnly = true;
  config.retries = 3;
}
setConfig(config);

const getExecutablePath = (browserName: BrowserName) => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
};

const serverEnv = new ServerEnv();

const browsers = ['chromium', 'webkit', 'firefox'] as BrowserName[];
for (const browserName of browsers) {
  const executablePath = getExecutablePath(browserName);
  const options = {
    mode: (process.env.PWMODE || 'default') as ('default' | 'driver' | 'service'),
    executablePath,
    trace: !!process.env.PWTRACE,
    headless: !process.env.HEADFUL,
    channel: process.env.PW_CHROMIUM_CHANNEL as any,
    video: !!process.env.PWVIDEO,
  };
  playwrightTest.runWith(browserName, serverEnv, new PlaywrightEnv(browserName, options), {});
  playwrightSlowTest.runWith(browserName, serverEnv, new PlaywrightEnv(browserName, options), { timeout: config.timeout * 3 });
  browserTest.runWith(browserName, serverEnv, new BrowserEnv(browserName, options), {});
  pageTest.runWith(browserName, serverEnv, new PageEnv(browserName, options), {});
}
