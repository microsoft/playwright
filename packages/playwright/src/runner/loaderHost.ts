/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ProcessHost } from './processHost';
import { incorporateCompilationCache } from '../common/esmLoaderHost';
import { serializeConfig } from '../common/ipc';
import { PoolBuilder } from '../common/poolBuilder';
import { Suite } from '../common/test';
import { loadTestFile } from '../common/testLoader';
import { addToCompilationCache } from '../transform/compilationCache';

import type { TestError } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';


export class InProcessLoaderHost {
  private _config: FullConfigInternal;
  private _poolBuilder: PoolBuilder;

  constructor(config: FullConfigInternal) {
    this._config = config;
    this._poolBuilder = PoolBuilder.createForLoader();
  }

  async start(errors: TestError[]) {
    return true;
  }

  async loadTestFile(file: string, testErrors: TestError[]): Promise<Suite> {
    const result = await loadTestFile(file, this._config.config.rootDir, testErrors);
    this._poolBuilder.buildPools(result, testErrors);
    return result;
  }

  async stop() {
    await incorporateCompilationCache();
  }
}

export class OutOfProcessLoaderHost {
  private _config: FullConfigInternal;
  private _processHost: ProcessHost;

  constructor(config: FullConfigInternal) {
    this._config = config;
    this._processHost = new ProcessHost(require.resolve('../loader/loaderMain.js'), 'loader', {});
  }

  async start(errors: TestError[]) {
    const startError = await this._processHost.startRunner(serializeConfig(this._config, false));
    if (startError) {
      errors.push({
        message: `Test loader process failed to start with code "${startError.code}" and signal "${startError.signal}"`,
      });
      return false;
    }
    return true;
  }

  async loadTestFile(file: string, testErrors: TestError[]): Promise<Suite> {
    const result = await this._processHost.sendMessage({ method: 'loadTestFile', params: { file } }) as any;
    testErrors.push(...result.testErrors);
    return Suite._deepParse(result.fileSuite);
  }

  async stop() {
    const result = await this._processHost.sendMessage({ method: 'getCompilationCacheFromLoader' }) as any;
    addToCompilationCache(result);
    await this._processHost.stop();
  }
}
