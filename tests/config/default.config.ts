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
import { PlaywrightEnvOptions } from './browserTest';
import { test as pageTest } from '../page/pageTest';
import { BrowserName, CommonArgs, CommonOptions } from './baseTest';
import type { Browser, BrowserContext } from '../../index';

const getExecutablePath = (browserName: BrowserName) => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
};

type AllOptions = PlaywrightEnvOptions & CommonOptions;

class PageEnv {
  private _browser: Browser
  private _browserVersion: string;
  private _browserMajorVersion: number;
  private _context: BrowserContext | undefined;

  async beforeAll(args: AllOptions & CommonArgs, workerInfo: folio.WorkerInfo) {
    this._browser = await args.playwright[args.browserName].launch({
      ...args.launchOptions,
      _traceDir: args.traceDir,
      channel: args.browserChannel,
      headless: !args.headful,
      handleSIGINT: false,
    } as any);
    this._browserVersion = this._browser.version();
    this._browserMajorVersion = Number(this._browserVersion.split('.')[0]);
    return {};
  }

  async beforeEach(args: CommonArgs, testInfo: folio.TestInfo) {
    testInfo.data.browserVersion = this._browserVersion;
    this._context = await this._browser.newContext({
      recordVideo: args.video ? { dir: testInfo.outputPath('') } : undefined,
    });
    const page = await this._context.newPage();
    return {
      context: this._context,
      page,
      browserVersion: this._browserVersion,
      browserMajorVersion: this._browserMajorVersion,
      isAndroid: false,
      isElectron: false,
    };
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

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: folio.Config<AllOptions> = {
  testDir,
  outputDir,
  timeout: process.env.PWTEST_VIDEO || process.env.PWTRACE ? 60000 : 30000,
  globalTimeout: 5400000,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  reporter: process.env.CI ? [
    'dot',
    { name: 'json', outputFile: path.join(outputDir, 'report.json') },
  ] : 'line',
  projects: [],
};

for (const browserName of ['chromium', 'webkit', 'firefox'] as BrowserName[]) {
  const executablePath = getExecutablePath(browserName);
  if (executablePath && (process.env.FOLIO_WORKER_INDEX === undefined || process.env.FOLIO_WORKER_INDEX === ''))
    console.error(`Using executable at ${executablePath}`);
  config.projects.push({
    name: browserName,
    testDir,
    testIgnore: [/android/, /electron/],
    options: {
      mode: (process.env.PWTEST_MODE || 'default') as ('default' | 'driver' | 'service'),
      browserName,
      headful: !!process.env.HEADFUL,
      channel: process.env.PWTEST_CHANNEL as any,
      video: !!process.env.PWTEST_VIDEO,
      traceDir: process.env.PWTRACE ? path.join(outputDir, 'trace') : undefined,
      launchOptions: {
        executablePath,
      },
      coverageName: browserName,
    },
    define: { test: pageTest, env: new PageEnv() },
  });
}

export default config;
