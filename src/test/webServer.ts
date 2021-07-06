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
/* eslint-disable no-console */

import { ChildProcess, spawn } from 'child_process';
import net from 'net';
import os from 'os';
import stream from 'stream';
import { monotonicTime, raceAgainstDeadline } from './util';
import { WebServerConfig } from '../../types/test';
import { assert, killProcessGroup } from '../utils/utils';

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none', // Disable that create-react-app will open the page in the browser
};

const newProcessLogPrefixer = () => new stream.Transform({
  transform(this: stream.Transform, chunk: Buffer, encoding: string, callback: stream.TransformCallback) {
    this.push(chunk.toString().split(os.EOL).map((line: string): string => line ? `[WebServer] ${line}` : line).join(os.EOL));
    callback();
  },
});

export class WebServer {
  private _process?: ChildProcess;
  private _processExitedWithNonZeroStatusCode!: Promise<any>;
  constructor(private readonly config: WebServerConfig) { }

  public static async create(config: WebServerConfig): Promise<WebServer> {
    const webServer = new WebServer(config);
    if (config.port)
      await webServer._verifyFreePort(config.port);
    try {
      const port = await webServer._startWebServer();
      await webServer._waitForAvailability(port);
      process.env.PLAYWRIGHT_TEST_BASE_URL = `http://localhost:${port}`;
      return webServer;
    } catch (error) {
      await webServer.kill();
      throw error;
    }
  }

  private async _verifyFreePort(port: number) {
    const cancellationToken = { canceled: false };
    const portIsUsed = await Promise.race([
      new Promise(resolve => setTimeout(() => resolve(false), 100)),
      waitForSocket(port, 100, cancellationToken),
    ]);
    cancellationToken.canceled = true;
    if (portIsUsed)
      throw new Error(`Port ${port} is used, make sure that nothing is running on the port`);
  }

  private async _startWebServer(): Promise<number> {
    let collectPortResolve = (port: number) => { };
    const collectPortPromise = new Promise<number>(resolve => collectPortResolve = resolve);
    function collectPort(data: Buffer) {
      const regExp = /http:\/\/localhost:(\d+)/.exec(data.toString());
      if (regExp)
        collectPortResolve(parseInt(regExp[1], 10));
    }

    this._process = spawn(this.config.command, {
      env: {
        ...DEFAULT_ENVIRONMENT_VARIABLES,
        ...process.env,
        ...this.config.env,
      },
      cwd: this.config.cwd,
      shell: true,
      // On non-windows platforms, `detached: true` makes child process a leader of a new
      // process group, making it possible to kill child process tree with `.kill(-pid)` command.
      // @see https://nodejs.org/api/child_process.html#child_process_options_detached
      detached: process.platform !== 'win32',
    });
    this._process.stdout.pipe(newProcessLogPrefixer()).pipe(process.stdout);
    this._process.stderr.pipe(newProcessLogPrefixer()).pipe(process.stderr);
    if (!this.config.port)
      this._process.stdout.on('data', collectPort);
    let processExitedWithNonZeroStatusCodeCallback = (error: Error) => { };
    this._processExitedWithNonZeroStatusCode = new Promise((_, reject) => processExitedWithNonZeroStatusCodeCallback = reject);
    this._process.on('exit', code => processExitedWithNonZeroStatusCodeCallback(new Error(`WebServer was not able to start. Exit code: ${code}`)));
    if (this.config.port)
      return this.config.port;
    console.log(`Starting WebServer port detection.`);
    const detectedPort = await Promise.race([
      this._processExitedWithNonZeroStatusCode,
      collectPortPromise,
    ]);
    console.log(`Port ${detectedPort} by process '${this.config.command}' was automatically detected.`);
    return detectedPort;
  }

  private async _waitForAvailability(port: number) {
    const launchTimeout = this.config.timeout || 60 * 1000;
    const cancellationToken = { canceled: false };
    const { timedOut } = (await Promise.race([
      raceAgainstDeadline(waitForSocket(port, 100, cancellationToken), launchTimeout + monotonicTime()),
      this._processExitedWithNonZeroStatusCode,
    ]));
    cancellationToken.canceled = true;
    if (timedOut)
      throw new Error(`failed to start web server on port ${port} via "${this.config.command}"`);
  }
  public async kill() {
    assert(this._process);
    if (this._process.exitCode !== null || this._process.killed)
      return;
    const waitForExit = new Promise(resolve => this._process?.on('exit',resolve));
    killProcessGroup(this._process.pid);
    await waitForExit;
  }
}

async function waitForSocket(port: number, delay: number, cancellationToken: { canceled: boolean }) {
  while (!cancellationToken.canceled) {
    const connected = await new Promise(resolve => {
      const conn = net
          .connect(port)
          .on('error', () => {
            resolve(false);
          })
          .on('connect', () => {
            conn.end();
            resolve(true);
          });
    });
    if (connected)
      return;
    await new Promise(x => setTimeout(x, delay));
  }
}
