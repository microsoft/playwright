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
import { ElectronEnv } from './electronTest';
import { test as pageTest } from '../page/pageTest';
import { PlaywrightEnvOptions } from './browserTest';
import { CommonOptions } from './baseTest';

class ElectronPageEnv extends ElectronEnv {
  async beforeEach(args: any, testInfo: folio.TestInfo) {
    const result = await super.beforeEach(args, testInfo);
    const page = await result.newWindow();
    return {
      ...result,
      browserVersion: this._browserVersion,
      browserMajorVersion: this._browserMajorVersion,
      page,
      isAndroid: false,
      isElectron: true,
    };
  }
}

type AllOptions = PlaywrightEnvOptions & CommonOptions;

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: folio.Config<AllOptions> = {
  testDir,
  outputDir,
  timeout: 30000,
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

config.projects.push({
  name: 'electron',
  options: {
    coverageName: 'electron'
  },
  testDir: path.join(testDir, 'electron'),
});

config.projects.push({
  name: 'electron',
  options: {
    coverageName: 'electron'
  },
  testDir: path.join(testDir, 'page'),
  define: { test: pageTest, env: new ElectronPageEnv() },
});

export default config;
