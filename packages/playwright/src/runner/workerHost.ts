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

import fs from 'fs';
import path from 'path';
import type { TestGroup } from './testGroups';
import { stdioChunkToParams } from '../common/ipc';
import type { RunPayload, SerializedConfig, WorkerInitParams } from '../common/ipc';
import { ProcessHost } from './processHost';
import { artifactsFolderName } from '../isomorphic/folders';
import { removeFolders } from 'playwright-core/lib/utils';

let lastWorkerIndex = 0;

export class WorkerHost extends ProcessHost {
  readonly parallelIndex: number;
  readonly workerIndex: number;
  private _hash: string;
  private _params: WorkerInitParams;
  private _didFail = false;

  constructor(testGroup: TestGroup, parallelIndex: number, config: SerializedConfig, extraEnv: Record<string, string | undefined>, outputDir: string) {
    const workerIndex = lastWorkerIndex++;
    super(require.resolve('../worker/workerMain.js'), `worker-${workerIndex}`, {
      ...extraEnv,
      FORCE_COLOR: '1',
      DEBUG_COLORS: '1',
    });
    this.workerIndex = workerIndex;
    this.parallelIndex = parallelIndex;
    this._hash = testGroup.workerHash;

    this._params = {
      workerIndex: this.workerIndex,
      parallelIndex,
      repeatEachIndex: testGroup.repeatEachIndex,
      projectId: testGroup.projectId,
      config,
      artifactsDir: path.join(outputDir, artifactsFolderName(workerIndex))
    };
  }

  async start() {
    await fs.promises.mkdir(this._params.artifactsDir, { recursive: true });
    return await this.startRunner(this._params, {
      onStdOut: chunk => this.emit('stdOut', stdioChunkToParams(chunk)),
      onStdErr: chunk => this.emit('stdErr', stdioChunkToParams(chunk)),
    });
  }

  override async onExit() {
    await removeFolders([this._params.artifactsDir]);
  }

  override async stop(didFail?: boolean) {
    if (didFail)
      this._didFail = true;
    await super.stop();
  }

  runTestGroup(runPayload: RunPayload) {
    this.sendMessageNoReply({ method: 'runTestGroup', params: runPayload });
  }

  hash() {
    return this._hash;
  }

  didFail() {
    return this._didFail;
  }
}
