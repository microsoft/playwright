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
import { test as pageTest } from './pageTest';
import { AndroidEnv, androidTest } from './androidTest';
import type { BrowserContext } from '../../index';

const config: folio.Config = {
  testDir: path.join(__dirname, '..'),
  outputDir: path.join(__dirname, '..', '..', 'test-results'),
  timeout: 120000,
  globalTimeout: 7200000,
  workers: 1,
};
if (process.env.CI) {
  config.forbidOnly = true;
  config.retries = 1;  // Multiple retries are too slow on Android.
}
folio.setConfig(config);

if (process.env.CI) {
  folio.setReporters([
    new folio.reporters.dot(),
    new folio.reporters.json({ outputFile: path.join(__dirname, '..', '..', 'test-results', 'report.json') }),
  ]);
}

class AndroidPageEnv extends AndroidEnv {
  private _context?: BrowserContext;

  async beforeAll(args: any, workerInfo: folio.WorkerInfo) {
    await super.beforeAll(args, workerInfo);
    this._context = await this._device!.launchBrowser();
  }

  async beforeEach(args: any, testInfo: folio.TestInfo) {
    const result = await super.beforeEach(args, testInfo);
    const page = await this._context!.newPage();
    return { ...result, browserVersion: this._browserVersion, browserMajorVersion: this._browserMajorVersion, page };
  }

  async afterEach({}, testInfo: folio.TestInfo) {
    for (const page of this._context!.pages())
      await page.close();
  }
}

const envConfig = {
  tag: 'android',
  options: {
    mode: 'default' as const,
    engine: 'android' as const,
    loopback: '10.0.2.2',
  }
};

pageTest.runWith(envConfig, new AndroidPageEnv());
androidTest.runWith(envConfig);
