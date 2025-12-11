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

import { removeFolders } from 'playwright-core/lib/utils';

import { ProcessHost } from './processHost';
import { stdioChunkToParams } from '../common/ipc';
import { artifactsFolderName } from '../isomorphic/folders';

import { addLocationAndSnippetToError } from '../reporters/internalReporter';
import { serializeError } from '../util';
import type { TestGroup } from './testGroups';
import type { CustomMessageRequestPayload, CustomMessageResponsePayload, RunPayload, SerializedConfig, ResumePayload, WorkerInitParams } from '../common/ipc';
import type { TestRun } from './tasks';


let lastWorkerIndex = 0;

type WorkerHostOptions = {
  parallelIndex: number;
  config: SerializedConfig;
  extraEnv: Record<string, string | undefined>;
  outputDir: string;
  pauseOnError: boolean;
  pauseAtEnd: boolean;
};

export class WorkerHost extends ProcessHost {
  readonly parallelIndex: number;
  readonly workerIndex: number;
  private _hash: string;
  private _params: WorkerInitParams;
  private _didFail = false;
  private _testRun: TestRun;

  constructor(testRun: TestRun, testGroup: TestGroup, options: WorkerHostOptions) {
    const workerIndex = lastWorkerIndex++;
    super(require.resolve('../worker/workerMain.js'), `worker-${workerIndex}`, {
      ...options.extraEnv,
      FORCE_COLOR: '1',
      DEBUG_COLORS: process.env.DEBUG_COLORS === undefined ? '1' : process.env.DEBUG_COLORS,
    });
    this.workerIndex = workerIndex;
    this.parallelIndex = options.parallelIndex;
    this._hash = testGroup.workerHash;
    this._testRun = testRun;

    this._params = {
      workerIndex: this.workerIndex,
      parallelIndex: options.parallelIndex,
      repeatEachIndex: testGroup.repeatEachIndex,
      projectId: testGroup.projectId,
      config: options.config,
      artifactsDir: path.join(options.outputDir, artifactsFolderName(workerIndex)),
      pauseOnError: options.pauseOnError,
      pauseAtEnd: options.pauseAtEnd,
    };
  }

  artifactsDir() {
    return this._params.artifactsDir;
  }

  async start() {
    await fs.promises.mkdir(this._params.artifactsDir, { recursive: true });
    this._testRun.onDidStartWorker(this);
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
    this._testRun.onDidStopWorker(this);
  }

  runTestGroup(runPayload: RunPayload) {
    this.sendMessageNoReply({ method: 'runTestGroup', params: runPayload });
  }

  async sendCustomMessage(payload: CustomMessageRequestPayload) {
    try {
      const response = await this.sendMessage({ method: 'customMessage', params: payload }) as CustomMessageResponsePayload;
      if (response.error)
        addLocationAndSnippetToError(this._testRun.config.config, response.error);
      return response;
    } catch (e) {
      const error = serializeError(e);
      addLocationAndSnippetToError(this._testRun.config.config, error);
      return { response: undefined, error };
    }
  }

  sendResume(payload: ResumePayload) {
    this.sendMessageNoReply({ method: 'resume', params: payload });
  }

  hash() {
    return this._hash;
  }

  projectId() {
    return this._params.projectId;
  }

  didFail() {
    return this._didFail;
  }
}
