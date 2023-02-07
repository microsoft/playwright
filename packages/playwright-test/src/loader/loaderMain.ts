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

import type { SerializedConfig } from '../common/ipc';
import { ConfigLoader } from '../common/configLoader';
import { ProcessRunner } from '../common/process';
import type { FullConfigInternal } from '../common/types';
import { loadTestFile } from '../common/testLoader';
import type { TestError } from '../../reporter';
import { addToCompilationCache, serializeCompilationCache } from '../common/compilationCache';
import { PoolBuilder } from '../common/poolBuilder';

export class LoaderMain extends ProcessRunner {
  private _serializedConfig: SerializedConfig;
  private _configPromise: Promise<FullConfigInternal> | undefined;
  private _poolBuilder = PoolBuilder.createForLoader();

  constructor(serializedConfig: SerializedConfig) {
    super();
    addToCompilationCache(serializedConfig.compilationCache);
    this._serializedConfig = serializedConfig;
  }

  private _config(): Promise<FullConfigInternal> {
    if (!this._configPromise)
      this._configPromise = ConfigLoader.deserialize(this._serializedConfig).then(configLoader => configLoader.fullConfig());
    return this._configPromise;
  }

  async loadTestFile(params: { file: string }) {
    const testErrors: TestError[] = [];
    const config = await this._config();
    const fileSuite = await loadTestFile(params.file, config.rootDir, testErrors);
    this._poolBuilder.buildPools(fileSuite);
    return { fileSuite: fileSuite._deepSerialize(), testErrors };
  }

  async serializeCompilationCache() {
    return serializeCompilationCache();
  }
}

export const create = (config: SerializedConfig) => new LoaderMain(config);
