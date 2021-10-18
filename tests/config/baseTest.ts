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

import { Fixtures, _baseTest } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { installCoverageHooks } from './coverage';
import { start } from '../../packages/playwright-core/lib/outofprocess';
import { GridClient } from 'playwright-core/src/grid/gridClient';
import type { LaunchOptions } from 'playwright-core';
import { commonFixtures, CommonFixtures, serverFixtures, ServerFixtures, ServerOptions } from './commonFixtures';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
type Mode = 'default' | 'driver' | 'service';
type BaseOptions = {
  mode: Mode;
  browserName: BrowserName;
  channel: LaunchOptions['channel'];
  video: boolean | undefined;
  trace: boolean | undefined;
  headless: boolean | undefined;
};
type BaseFixtures = {
  platform: 'win32' | 'darwin' | 'linux';
  playwright: typeof import('playwright-core');
  toImpl: (rpcObject: any) => any;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
};

class DriverMode {
  private _playwrightObject: any;

  async setup(workerIndex: number) {
    this._playwrightObject = await start();
    return this._playwrightObject;
  }

  async teardown() {
    await this._playwrightObject.stop();
  }
}

class ServiceMode {
  private _gridClient: GridClient;

  async setup(workerIndex: number) {
    this._gridClient = await GridClient.connect('http://localhost:3333');
    return this._gridClient.playwright();
  }

  async teardown() {
    await this._gridClient.close();
  }
}

class DefaultMode {
  async setup(workerIndex: number) {
    return require('playwright-core');
  }

  async teardown() {
  }
}

const baseFixtures: Fixtures<{}, BaseOptions & BaseFixtures> = {
  mode: [ 'default', { scope: 'worker' } ],
  browserName: [ 'chromium' , { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  video: [ undefined, { scope: 'worker' } ],
  trace: [ undefined, { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  platform: [ process.platform as 'win32' | 'darwin' | 'linux', { scope: 'worker' } ],
  playwright: [ async ({ mode }, run, workerInfo) => {
    const modeImpl = {
      default: new DefaultMode(),
      service: new ServiceMode(),
      driver: new DriverMode(),
    }[mode];
    require('playwright-core/src/utils/utils').setUnderTest();
    const playwright = await modeImpl.setup(workerInfo.workerIndex);
    await run(playwright);
    await modeImpl.teardown();
  }, { scope: 'worker' } ],
  toImpl: [ async ({ playwright }, run) => run((playwright as any)._toImpl), { scope: 'worker' } ],
  isWindows: [ process.platform === 'win32', { scope: 'worker' } ],
  isMac: [ process.platform === 'darwin', { scope: 'worker' } ],
  isLinux: [ process.platform === 'linux', { scope: 'worker' } ],
};

type CoverageOptions = {
  coverageName?: string;
};

const coverageFixtures: Fixtures<{}, CoverageOptions & { __collectCoverage: void }> = {
  coverageName: [ undefined, { scope: 'worker' } ],

  __collectCoverage: [ async ({ coverageName }, run, workerInfo) => {
    if (!coverageName) {
      await run();
      return;
    }

    const { coverage, uninstall } = installCoverageHooks(coverageName);
    await run();
    uninstall();
    const coveragePath = path.join(__dirname, '..', 'coverage-report', workerInfo.workerIndex + '.json');
    const coverageJSON = Array.from(coverage.keys()).filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }, { scope: 'worker', auto: true } ],
};

export type CommonOptions = BaseOptions & ServerOptions & CoverageOptions;
export type CommonWorkerFixtures = CommonOptions & BaseFixtures;

export const baseTest = _baseTest.extend<CommonFixtures>(commonFixtures).extend<{}, CoverageOptions>(coverageFixtures).extend<ServerFixtures>(serverFixtures as any).extend<{}, BaseOptions & BaseFixtures>(baseFixtures);
