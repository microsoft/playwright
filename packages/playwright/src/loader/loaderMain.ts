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

import { deserializeConfig } from '../common/configLoader';
import { incorporateCompilationCache } from '../common/esmLoaderHost';
import { PoolBuilder } from '../common/poolBuilder';
import { ProcessRunner } from '../common/process';
import { loadTestFile } from '../common/testLoader';
import { serializeCompilationCache } from '../transform/compilationCache';

import type { TestError } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { SerializedConfig } from '../common/ipc';

export class LoaderMain extends ProcessRunner {
  private _serializedConfig: SerializedConfig;
  private _configPromise: Promise<FullConfigInternal> | undefined;
  private _poolBuilder = PoolBuilder.createForLoader();

  constructor(serializedConfig: SerializedConfig) {
    super();
    this._serializedConfig = serializedConfig;
  }

  private _config(): Promise<FullConfigInternal> {
    if (!this._configPromise)
      this._configPromise = deserializeConfig(this._serializedConfig);
    return this._configPromise;
  }

  async loadTestFile(params: { file: string }) {
    const testErrors: TestError[] = [];
    const config = await this._config();
    const fileSuite = await loadTestFile(params.file, config.config.rootDir, testErrors);
    this._poolBuilder.buildPools(fileSuite);
    return { fileSuite: fileSuite._deepSerialize(), testErrors };
  }

  async getCompilationCacheFromLoader() {
    await incorporateCompilationCache();
    return serializeCompilationCache();
  }
}

export const create = (config: SerializedConfig) => new LoaderMain(config);
