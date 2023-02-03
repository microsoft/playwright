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

import type { TestError } from '../../reporter';
import { serializeConfig } from '../common/ipc';
import { ProcessHost } from './processHost';
import { Suite } from '../common/test';
import { loadTestFile } from '../common/testLoader';
import type { LoadError } from '../common/fixtures';
import type { FullConfigInternal } from '../common/types';
import { PoolBuilder } from '../common/poolBuilder';
import { addToCompilationCache } from '../common/compilationCache';

export abstract class LoaderHost {
  protected _config: FullConfigInternal;
  private _poolBuilder: PoolBuilder;

  constructor(config: FullConfigInternal) {
    this._config = config;
    this._poolBuilder = PoolBuilder.createForLoader();
  }

  async loadTestFile(file: string, testErrors: TestError[]): Promise<Suite> {
    const result = await this.doLoadTestFile(file, testErrors);
    this._poolBuilder.buildPools(result, testErrors);
    return result;
  }

  protected abstract doLoadTestFile(file: string, testErrors: TestError[]): Promise<Suite>;

  async stop() {}
}

export class InProcessLoaderHost extends LoaderHost {

  doLoadTestFile(file: string, testErrors: TestError[]): Promise<Suite> {
    return loadTestFile(file, this._config.rootDir, testErrors);
  }
}

export class OutOfProcessLoaderHost extends LoaderHost {
  private _startPromise: Promise<void>;
  private _processHost: ProcessHost;

  constructor(config: FullConfigInternal) {
    super(config);
    this._processHost = new ProcessHost(require.resolve('../loader/loaderMain.js'), 'loader');
    this._startPromise = this._processHost.startRunner(serializeConfig(config), true, {});
  }

  async doLoadTestFile(file: string, loadErrors: LoadError[]): Promise<Suite> {
    await this._startPromise;
    const result = await this._processHost.sendMessage({ method: 'loadTestFile', params: { file } }) as any;
    loadErrors.push(...result.testErrors);
    return Suite._deepParse(result.fileSuite);
  }

  override async stop() {
    const result = await this._processHost.sendMessage({ method: 'serializeCompilationCache' }) as any;
    addToCompilationCache(result);
    await this._processHost.stop();
  }
}
