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

import type { Worker } from 'playwright-core';
import { FixtureRunner, getRequiredFixtureNames } from './fixtureRunner';
import type { TestInfoImpl } from './testInfo';

const toProcessParamFixtureKeys = [
  'page',
  'server',
  'crx',
  'context',
];

const asIsSupportedParamFixtureKeys = [
  'browserName',
  'headless',
  'channel',
  'screenshot',
  'trace',
  'video',
  'browserName',
  'browserVersion',
  'browserMajorVersion',
  'isAndroid',
  'isElectron',
  'isWebView2',
  'platform',
  'isWindows',
  'isMac',
  'isLinux',
];

const supportedParamFixtureKeys = [
  ...toProcessParamFixtureKeys,
  ...asIsSupportedParamFixtureKeys,
];

export default class CrxFixtureRunner extends FixtureRunner {

  override earlyExpectedStatus(testInfo: TestInfoImpl) {
    if (!this._runsInWorker(testInfo)) return;

    const names = getRequiredFixtureNames(testInfo.fn);
    if (!names.every(name => supportedParamFixtureKeys.includes(name)))
      testInfo.expectedStatus = 'skipped';
  }

  override async runFunction(fn: Function, testFunctionParams: any, testInfo: TestInfoImpl) {
    if (!this._runsInWorker(testInfo))
      return super.runFunction(fn, testFunctionParams, testInfo);

    const { page, crx, server: serverObj } = testFunctionParams as any;
    const worker = crx?.extensionServiceWorker ?? page?.extensionServiceWorker as Worker;

    if (!worker)
      // fallback to default
      return super.runFunction(fn, testFunctionParams, testInfo);

    let server;
    if (serverObj) {
      const { PORT, PREFIX, CROSS_PROCESS_PREFIX, EMPTY_PAGE } = serverObj;
      server = { PORT, PREFIX, CROSS_PROCESS_PREFIX, EMPTY_PAGE };
    }

    const params: any = server ? { server } : {};

    if (testFunctionParams) {
      for (const key of asIsSupportedParamFixtureKeys) {
        if (key in testFunctionParams)
          params[key] = testFunctionParams[key];
      }
    }

    try {
      const fnBody = fn.toString()
          .replaceAll(/\w+\.expect/g, 'expect')
          .replaceAll(/\_\w+Test\.test/g, 'test');
      await worker.evaluate(new Function(`return async (fixtures) => {
        const { test, expect, _runTest, _crxPromise } = self;
        const crx = await _crxPromise;
        await _runTest(${fnBody}, { crx, ...fixtures });
      }`)(), {
        server,
        ...params,
      });
    } catch (e) {
      if (e.message) {
        const [, notDefinedVar] = /ReferenceError: (\S+) is not defined/.exec(e.message) ?? [];
        if (!notDefinedVar) throw e;
        testInfo.skip(true, `Skipping test because it contains a variable defined outside the scope: ${notDefinedVar}`);
      }
    }
  }

  private _runsInWorker(testInfo: TestInfoImpl) {
    const mode = testInfo.project.metadata.mode ?? testInfo.config.metadata.mode;
    return mode === 'crx';
  }
}
