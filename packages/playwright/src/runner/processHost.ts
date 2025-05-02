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

import child_process from 'child_process';
import { EventEmitter } from 'events';

import { assert, timeOrigin } from 'playwright-core/lib/utils';
import { debug } from 'playwright-core/lib/utilsBundle';

import type { EnvProducedPayload, ProcessInitParams } from '../common/ipc';
import type { ProtocolResponse } from '../common/process';

export type ProcessExitData = {
  unexpectedly: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
};

export class ProcessHost extends EventEmitter {
  private process: child_process.ChildProcess | undefined;
  private _didSendStop = false;
  private _processDidExit = false;
  private _didExitAndRanOnExit = false;
  private _runnerScript: string;
  private _lastMessageId = 0;
  private _callbacks = new Map<number, { resolve: (result: any) => void, reject: (error: Error) => void }>();
  private _processName: string;
  private _producedEnv: Record<string, string | undefined> = {};
  private _extraEnv: Record<string, string | undefined>;

  constructor(runnerScript: string, processName: string, env: Record<string, string | undefined>) {
    super();
    this._runnerScript = runnerScript;
    this._processName = processName;
    this._extraEnv = env;
  }

  async startRunner(runnerParams: any, options: { onStdOut?: (chunk: Buffer | string) => void, onStdErr?: (chunk: Buffer | string) => void } = {}): Promise<ProcessExitData | undefined> {
    assert(!this.process, 'Internal error: starting the same process twice');
    this.process = child_process.fork(require.resolve('../common/process'), {
      detached: false,
      env: {
        ...process.env,
        ...this._extraEnv,
      },
      stdio: [
        'ignore',
        options.onStdOut ? 'pipe' : 'inherit',
        (options.onStdErr && !process.env.PW_RUNNER_DEBUG) ? 'pipe' : 'inherit',
        'ipc',
      ],
    });
    this.process.on('exit', async (code, signal) => {
      this._processDidExit = true;
      await this.onExit();
      this._didExitAndRanOnExit = true;
      this.emit('exit', { unexpectedly: !this._didSendStop, code, signal } as ProcessExitData);
    });
    this.process.on('error', e => {});  // do not yell at a send to dead process.
    this.process.on('message', (message: any) => {
      if (debug.enabled('pw:test:protocol'))
        debug('pw:test:protocol')('◀ RECV ' + JSON.stringify(message));
      if (message.method === '__env_produced__') {
        const producedEnv: EnvProducedPayload = message.params;
        this._producedEnv = Object.fromEntries(producedEnv.map(e => [e[0], e[1] ?? undefined]));
      } else if (message.method === '__dispatch__') {
        const { id, error, method, params, result } = message.params as ProtocolResponse;
        if (id && this._callbacks.has(id)) {
          const { resolve, reject } = this._callbacks.get(id)!;
          this._callbacks.delete(id);
          if (error) {
            const errorObject = new Error(error.message);
            errorObject.stack = error.stack;
            reject(errorObject);
          } else {
            resolve(result);
          }
        } else {
          this.emit(method!, params);
        }
      } else {
        this.emit(message.method!, message.params);
      }
    });

    if (options.onStdOut)
      this.process.stdout?.on('data', options.onStdOut);
    if (options.onStdErr)
      this.process.stderr?.on('data', options.onStdErr);

    const error = await new Promise<ProcessExitData | undefined>(resolve => {
      this.process!.once('exit', (code, signal) => resolve({ unexpectedly: true, code, signal }));
      this.once('ready', () => resolve(undefined));
    });

    if (error)
      return error;

    const processParams: ProcessInitParams = {
      processName: this._processName,
      timeOrigin: timeOrigin(),
    };

    this.send({
      method: '__init__', params: {
        processParams,
        runnerScript: this._runnerScript,
        runnerParams
      }
    });
  }

  sendMessage(message: { method: string, params?: any }) {
    const id = ++this._lastMessageId;
    this.send({
      method: '__dispatch__',
      params: { id, ...message }
    });
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
    });
  }

  protected sendMessageNoReply(message: { method: string, params?: any }) {
    this.sendMessage(message).catch(() => {});
  }

  protected async onExit() {
  }

  async stop() {
    if (!this._processDidExit && !this._didSendStop) {
      this.send({ method: '__stop__' });
      this._didSendStop = true;
    }
    if (!this._didExitAndRanOnExit)
      await new Promise(f => this.once('exit', f));
  }

  didSendStop() {
    return this._didSendStop;
  }

  producedEnv() {
    return this._producedEnv;
  }

  private send(message: { method: string, params?: any }) {
    if (debug.enabled('pw:test:protocol'))
      debug('pw:test:protocol')('SEND ► ' + JSON.stringify(message));
    this.process?.send(message);
  }
}
