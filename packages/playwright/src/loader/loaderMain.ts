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

import { cc, configLoader, esm, FullConfigInternal, ipc, poolBuilder, ProcessRunner, testLoader } from '../common';

import type { TestError } from '../../types/testReporter';

export class LoaderMain extends ProcessRunner {
  private _serializedConfig: ipc.SerializedConfig;
  private _configPromise: Promise<FullConfigInternal> | undefined;
  private _poolBuilder = poolBuilder.PoolBuilder.createForLoader();

  constructor(serializedConfig: ipc.SerializedConfig) {
    super();
    this._serializedConfig = serializedConfig;
  }

  private _config(): Promise<FullConfigInternal> {
    if (!this._configPromise)
      this._configPromise = configLoader.deserializeConfig(this._serializedConfig);
    return this._configPromise;
  }

  async loadTestFile(params: { file: string }) {
    const testErrors: TestError[] = [];
    const config = await this._config();
    const fileSuite = await testLoader.loadTestFile(params.file, config, testErrors);
    this._poolBuilder.buildPools(fileSuite);
    return { fileSuite: fileSuite._deepSerialize(), testErrors };
  }

  async getCompilationCacheFromLoader() {
    await esm.incorporateCompilationCache();
    return cc.serializeCompilationCache();
  }
}

export const create = (config: ipc.SerializedConfig) => new LoaderMain(config);
