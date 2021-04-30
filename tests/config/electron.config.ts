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
import { ElectronEnv, electronTest } from './electronTest';
import { test as pageTest } from './pageTest';

const config: folio.Config = {
  testDir: path.join(__dirname, '..'),
  outputDir: path.join(__dirname, '..', '..', 'test-results'),
  timeout: 30000,
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

class ElectronPageEnv extends ElectronEnv {
  async beforeEach(args: any, testInfo: folio.TestInfo) {
    const result = await super.beforeEach(args, testInfo);
    const page = await result.newWindow();
    return {
      ...result,
      browserVersion: this._browserVersion,
      browserMajorVersion: this._browserMajorVersion,
      page,
    };
  }
}

const envConfig = {
  tag: 'electron',
  options: {
    mode: 'default' as const,
    engine: 'electron' as const,
    coverageName: 'electron'
  }
};

electronTest.runWith(envConfig);
pageTest.runWith(envConfig, new ElectronPageEnv());
