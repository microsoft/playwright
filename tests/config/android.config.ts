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
import { test as pageTest } from '../page/pageTest';
import { AndroidEnv } from '../android/androidTest';
import type { BrowserContext } from '../../index';
import { PlaywrightEnvOptions } from './browserTest';
import { CommonOptions } from './baseTest';

class AndroidPageEnv extends AndroidEnv {
  private _context?: BrowserContext;

  async beforeAll(args: any, workerInfo: folio.WorkerInfo) {
    await super.beforeAll(args, workerInfo);
    this._context = await this._device!.launchBrowser();
  }

  async beforeEach(args: any, testInfo: folio.TestInfo) {
    const result = await super.beforeEach(args, testInfo);
    const page = await this._context!.newPage();
    return { ...result, browserVersion: this._browserVersion, browserMajorVersion: this._browserMajorVersion, page, isAndroid: true, isElectron: false };
  }

  async afterEach({}, testInfo: folio.TestInfo) {
    for (const page of this._context!.pages())
      await page.close();
  }
}

type AllOptions = PlaywrightEnvOptions & CommonOptions;

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: folio.Config<AllOptions> = {
  testDir,
  outputDir,
  timeout: 120000,
  globalTimeout: 7200000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [
    'dot',
    { name: 'json', outputFile: path.join(outputDir, 'report.json') },
  ] : 'line',
  projects: [],
};

config.projects.push({
  name: 'android',
  options: {
    loopback: '10.0.2.2',
  },
  testDir: path.join(testDir, 'android'),
});

config.projects.push({
  name: 'android',
  options: {
    loopback: '10.0.2.2',
  },
  testDir: path.join(testDir, 'page'),
  define: { test: pageTest, env: new AndroidPageEnv() },
});

export default config;
