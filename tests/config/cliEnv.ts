/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Env, TestInfo, WorkerInfo } from 'folio';
import { PageEnv } from './browserEnv';
import { CLIMock, CLITestArgs, Recorder } from './cliTest';
import * as http from 'http';
import { chromium } from '../../index';

export class CLIEnv extends PageEnv implements Env<CLITestArgs> {
  private _server: http.Server | undefined;
  private _handler = (req: http.IncomingMessage, res: http.ServerResponse) => res.end();
  private _port: number;
  private _cli: CLIMock | undefined;

  async beforeAll(workerInfo: WorkerInfo) {
    await super.beforeAll(workerInfo);

    this._port = 10907 + workerInfo.workerIndex * 2;
    this._server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => this._handler(req, res)).listen(this._port);
    process.env.PWTEST_RECORDER_PORT = String(this._port + 1);
  }

  private _runCLI(args: string[]) {
    this._cli = new CLIMock(this._browserName, this._browserOptions.channel, !!this._browserOptions.headless, args);
    return this._cli;
  }

  async beforeEach(testInfo: TestInfo) {
    const result = await super.beforeEach(testInfo);
    const { page, context, toImpl } = result;
    const recorderPageGetter = async () => {
      while (!toImpl(context).recorderAppForTest)
        await new Promise(f => setTimeout(f, 100));
      const wsEndpoint = toImpl(context).recorderAppForTest.wsEndpoint;
      const browser = await chromium.connectOverCDP({ wsEndpoint });
      const c = browser.contexts()[0];
      return c.pages()[0] || await c.waitForEvent('page');
    };
    return {
      ...result,
      httpServer: {
        setHandler: newHandler => this._handler = newHandler,
        PREFIX: `http://127.0.0.1:${this._port}`,
      },
      runCLI: this._runCLI.bind(this),
      openRecorder: async () => {
        await (page.context() as any)._enableRecorder({ language: 'javascript', startRecording: true });
        return new Recorder(page, await recorderPageGetter());
      },
      recorderPageGetter,
    };
  }

  async afterEach(testInfo: TestInfo) {
    if (this._cli) {
      await this._cli.exited;
      this._cli = undefined;
    }
    await super.afterEach(testInfo);
  }

  async afterAll(workerInfo: WorkerInfo) {
    if (this._server) {
      this._server.close();
      this._server = undefined;
    }
    await super.afterAll(workerInfo);
  }
}
