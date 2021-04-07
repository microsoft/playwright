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

import * as folio from 'folio';
import * as path from 'path';
import { test as playwrightTest, slowTest as playwrightSlowTest } from './playwrightTest';
import { test as browserTest, slowTest as browserSlowTest } from './browserTest';
import { test as contextTest } from './contextTest';
import { test as pageTest } from './pageTest';
import { test as electronTest } from './electronTest';
import { test as cliTest } from './cliTest';
import { PlaywrightEnv, BrowserEnv, PageEnv, BrowserName } from './browserEnv';
import { ServerEnv } from './serverEnv';
import { ElectronEnv } from './electronEnv';
import { CLIEnv } from './cliEnv';

const config: folio.Config = {
  testDir: path.join(__dirname, '..'),
  outputDir: path.join(__dirname, '..', '..', 'test-results'),
  timeout: process.env.PWVIDEO ? 60000 : 30000,
  globalTimeout: 5400000,
};
if (process.env.CI) {
  config.workers = 1;
  config.forbidOnly = true;
  config.retries = 3;
}
folio.setConfig(config);

if (process.env.CI) {
  folio.setReporters([
    new folio.reporters.dot(),
    new folio.reporters.json({ outputFile: path.join(__dirname, '..', '..', 'test-results', 'report.json') }),
  ]);
}

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
  if (executablePath && (process.env.FOLIO_WORKER_INDEX === undefined || process.env.FOLIO_WORKER_INDEX === ''))
    console.error(`Using executable at ${executablePath}`);
  const mode = (process.env.PWMODE || 'default') as ('default' | 'driver' | 'service');
  const options = {
    mode,
    executablePath,
    trace: !!process.env.PWTRACE,
    headless: !process.env.HEADFUL,
    channel: process.env.PW_CHROMIUM_CHANNEL as any,
    video: !!process.env.PWVIDEO,
  };
  playwrightTest.runWith(folio.merge(serverEnv, new PlaywrightEnv(browserName, options)), { tag: browserName });
  playwrightSlowTest.runWith(folio.merge(serverEnv, new PlaywrightEnv(browserName, options)), { timeout: config.timeout * 3, tag: browserName });
  browserTest.runWith(folio.merge(serverEnv, new BrowserEnv(browserName, options)), { tag: browserName });
  browserSlowTest.runWith(folio.merge(serverEnv, new BrowserEnv(browserName, options)), { timeout: config.timeout * 3, tag: browserName });
  pageTest.runWith(folio.merge(serverEnv, new PageEnv(browserName, options)), { tag: browserName });
  contextTest.runWith(folio.merge(serverEnv, new PageEnv(browserName, options)), { tag: browserName });
  if (mode !== 'service')
    cliTest.runWith(folio.merge(serverEnv, new CLIEnv(browserName, options)), { tag: browserName });
  if (browserName === 'chromium')
    electronTest.runWith(folio.merge(serverEnv, new ElectronEnv({ mode })), { tag: browserName });
}
