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
import type { RunPayload, SerializedConfig, TestOutputPayload, WorkerInitParams } from '../common/ipc';
import { ProcessHost } from './processHost';
import { artifactsFolderName } from '../isomorphic/folders';
import { removeFolders } from 'playwright-core/lib/utils';

let lastWorkerIndex = 0;

export class WorkerHost extends ProcessHost {
  readonly parallelIndex: number;
  readonly workerIndex: number;
  private _hash: string;
  currentTestId: string | null = null;
  private _params: WorkerInitParams;

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
    await this.startRunner(this._params, {
      onStdOut: rawChunk => {
        const [chunk, flushed] = splitChunkByFlushDelimiter(rawChunk);
        if (chunk)
          this.emit('stdOut', chunkToParams(chunk));
        if (flushed) {
          this.sendMessageNoReply({ method: 'stdOutFlushed' });
          return;
        }
      },
      onStdErr: rawChunk => {
        const [chunk, flushed] = splitChunkByFlushDelimiter(rawChunk);
        if (chunk)
          this.emit('stdErr', chunkToParams(chunk));
        if (flushed) {
          this.sendMessageNoReply({ method: 'stdErrFlushed' });
          return;
        }
      },
    });
  }

  override async stop(didFail?: boolean) {
    await super.stop(didFail);
    await removeFolders([this._params.artifactsDir]);
  }

  runTestGroup(runPayload: RunPayload) {
    this.sendMessageNoReply({ method: 'runTestGroup', params: runPayload });
  }

  hash() {
    return this._hash;
  }
}

function chunkToParams(chunk: Buffer | string): TestOutputPayload {
  if (chunk instanceof Buffer)
    return { buffer: chunk.toString('base64') };
  return { text: chunk };
}

function splitChunkByFlushDelimiter(chunk: Buffer): [Buffer | undefined, boolean] {
  const kFlushDelimiter = Buffer.from([0, 0, 0, 0]);
  const index = chunk.indexOf(kFlushDelimiter);
  if (index === -1)
    return [chunk, false];
  if (chunk.length === kFlushDelimiter.length)
    return [undefined, true];
  return [Buffer.concat([chunk.slice(0, index), chunk.slice(index + 4)]), true];
}
