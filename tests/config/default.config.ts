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
import { playwrightTest, slowPlaywrightTest, contextTest, tracingTest } from './browserTest';
import { test as pageTest } from './pageTest';
import { BrowserName, CommonTestArgs, CommonWorkerArgs } from './baseTest';
import type { Browser, BrowserContext } from '../../index';

const config: folio.Config = {
  testDir: path.join(__dirname, '..'),
  outputDir: path.join(__dirname, '..', '..', 'test-results'),
  timeout: process.env.PWTEST_VIDEO || process.env.PWTRACE ? 60000 : 30000,
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

type WorkerOptionsFor<T> = T extends folio.TestType<infer T, infer W, infer TO, infer WO> ? WO : any;
type AllOptions = WorkerOptionsFor<typeof contextTest>;

class PageEnv {
  private _browser: Browser
  private _browserVersion: string;
  private _browserMajorVersion: number;
  private _context: BrowserContext | undefined;

  async beforeAll(args: AllOptions & CommonWorkerArgs, workerInfo: folio.WorkerInfo) {
    this._browser = await args.playwright[args.browserName].launch({
      ...args.launchOptions,
      _traceDir: args.traceDir,
      channel: args.channel,
      headless: !args.headful,
      handleSIGINT: false,
    } as any);
    this._browserVersion = this._browser.version();
    this._browserMajorVersion = Number(this._browserVersion.split('.')[0]);
    return {};
  }

  async beforeEach(args: AllOptions & CommonTestArgs, testInfo: folio.TestInfo) {
    testInfo.data.browserVersion = this._browserVersion;
    this._context = await this._browser.newContext({
      recordVideo: args.video ? { dir: testInfo.outputPath('') } : undefined,
      ...args.contextOptions,
    });
    const page = await this._context.newPage();
    return { context: this._context, page, browserVersion: this._browserVersion, browserMajorVersion: this._browserMajorVersion };
  }

  async afterEach({}) {
    if (this._context)
      await this._context.close();
    this._context = undefined;
  }

  async afterAll({}, workerInfo: folio.WorkerInfo) {
    await this._browser.close();
  }
}

const browsers = ['chromium', 'webkit', 'firefox'] as BrowserName[];
for (const browserName of browsers) {
  const executablePath = getExecutablePath(browserName);
  if (executablePath && (process.env.FOLIO_WORKER_INDEX === undefined || process.env.FOLIO_WORKER_INDEX === ''))
    console.error(`Using executable at ${executablePath}`);
  const mode = (process.env.PWTEST_MODE || 'default') as ('default' | 'driver' | 'service');
  const envConfig = {
    options: {
      mode,
      engine: browserName,
      headful: !!process.env.HEADFUL,
      channel: process.env.PWTEST_CHANNEL as any,
      video: !!process.env.PWTEST_VIDEO,
      traceDir: process.env.PWTRACE ? path.join(config.outputDir, 'trace') : undefined,
      launchOptions: {
        executablePath,
      },
      coverageName: browserName,
    },
    tag: browserName,
  };
  playwrightTest.runWith(envConfig);
  slowPlaywrightTest.runWith({ ...envConfig, timeout: config.timeout * 3 });
  pageTest.runWith(envConfig, new PageEnv());
  tracingTest.runWith({ options: { ...envConfig.options, traceDir: path.join(config.outputDir, 'trace-' + process.env.FOLIO_WORKER_INDEX) }, tag: browserName });
}
