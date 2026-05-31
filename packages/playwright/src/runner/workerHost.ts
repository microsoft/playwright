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

import { assert } from '@isomorphic/assert';
import { removeFolders } from '@utils/fileUtils';

import { ProcessHost } from './processHost';
import { ipc } from '../common';
import { artifactsFolderName } from '../isomorphic/folders';

import type { TestGroup } from './testGroups';


let lastWorkerIndex = 0;

type WorkerHostOptions = {
  parallelIndex: number;
  config: ipc.SerializedConfig;
  extraEnv: Record<string, string | undefined>;
  outputDir: string;
  pauseOnError: boolean;
  pauseAtEnd: boolean;
};

type WorkerHostInitOptions = WorkerHostOptions & {
  testGroup: TestGroup;
};

export class WorkerHost extends ProcessHost {
  readonly workerIndex: number;
  private _parallelIndex: number;
  private _hash: string | undefined;
  private _params: ipc.WorkerInitParams | undefined;
  private _didFail = false;

  constructor(testGroup: TestGroup, options: WorkerHostOptions);
  constructor(parallelIndex: number);
  constructor(testGroupOrParallelIndex: TestGroup | number, options?: WorkerHostOptions) {
    const workerIndex = lastWorkerIndex++;
    const extraEnv = options?.extraEnv || {};
    super(require.resolve('../worker/workerProcessEntry.js'), `worker-${workerIndex}`, {
      ...extraEnv,
      FORCE_COLOR: '1',
      DEBUG_COLORS: process.env.DEBUG_COLORS === undefined ? '1' : process.env.DEBUG_COLORS,
    });
    this.workerIndex = workerIndex;
    this._parallelIndex = typeof testGroupOrParallelIndex === 'number' ? testGroupOrParallelIndex : options!.parallelIndex;

    if (typeof testGroupOrParallelIndex !== 'number')
      this.initialize({ ...options!, testGroup: testGroupOrParallelIndex });
  }

  get parallelIndex() {
    return this._parallelIndex;
  }

  initialize(options: WorkerHostInitOptions) {
    if (this._params)
      return;

    this._parallelIndex = options.parallelIndex;
    this._hash = options.testGroup.workerHash;

    this._params = {
      workerIndex: this.workerIndex,
      parallelIndex: options.parallelIndex,
      repeatEachIndex: options.testGroup.repeatEachIndex,
      projectId: options.testGroup.projectId,
      config: options.config,
      artifactsDir: path.join(options.outputDir, artifactsFolderName(this.workerIndex)),
      extraEnv: options.extraEnv,
      pauseOnError: options.pauseOnError,
      pauseAtEnd: options.pauseAtEnd,
    };
  }

  async start() {
    assert(this._params, 'Internal error: starting a worker before it is initialized');
    await fs.promises.mkdir(this._params.artifactsDir, { recursive: true });
    if (this.hasProcess()) {
      this.initRunner(this._params);
      return;
    }
    return await this.startRunner(this._params, {
      onStdOut: chunk => this.emit('stdOut', ipc.stdioChunkToParams(chunk)),
      onStdErr: chunk => this.emit('stdErr', ipc.stdioChunkToParams(chunk)),
    });
  }

  async prefork() {
    return await this.preforkRunner({
      onStdOut: chunk => this.emit('stdOut', ipc.stdioChunkToParams(chunk)),
      onStdErr: chunk => this.emit('stdErr', ipc.stdioChunkToParams(chunk)),
    });
  }

  override async onExit() {
    if (this._params)
      await removeFolders([this._params.artifactsDir]);
  }

  override async stop(didFail?: boolean) {
    if (didFail)
      this._didFail = true;
    await super.stop();
  }

  runTestGroup(runPayload: ipc.RunPayload) {
    this.sendMessageNoReply({ method: 'runTestGroup', params: runPayload });
  }

  async sendCustomMessage(payload: ipc.CustomMessageRequestPayload) {
    return await this.sendMessage({ method: 'customMessage', params: payload }) as ipc.CustomMessageResponsePayload;
  }

  sendResume(payload: ipc.ResumePayload) {
    this.sendMessageNoReply({ method: 'resume', params: payload });
  }

  hash() {
    return this._hash;
  }

  isInitialized() {
    return !!this._params;
  }

  projectId() {
    return this._params?.projectId;
  }

  didFail() {
    return this._didFail;
  }
}
