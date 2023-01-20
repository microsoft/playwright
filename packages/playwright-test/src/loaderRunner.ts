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

import type { SerializedConfig } from './ipc';
import type { TestError } from '../reporter';
import { ConfigLoader } from './configLoader';
import { ProcessRunner } from './process';
import { loadTestFilesInProcess } from './testLoader';
import { setFatalErrorSink } from './globals';

export class LoaderRunner extends ProcessRunner {
  private _config: SerializedConfig;
  private _configLoaderPromise: Promise<ConfigLoader> | undefined;

  constructor(config: SerializedConfig) {
    super();
    this._config = config;
  }

  private _configLoader(): Promise<ConfigLoader> {
    if (!this._configLoaderPromise)
      this._configLoaderPromise = ConfigLoader.deserialize(this._config);
    return this._configLoaderPromise;
  }

  async loadTestFiles(params: { files: string[] }) {
    const loadErrors: TestError[] = [];
    setFatalErrorSink(loadErrors);
    const configLoader = await this._configLoader();
    const rootSuite = await loadTestFilesInProcess(configLoader.fullConfig(), params.files, loadErrors);
    return { rootSuite: rootSuite._deepSerialize(), loadErrors };
  }
}

export const create = (config: SerializedConfig) => new LoaderRunner(config);
