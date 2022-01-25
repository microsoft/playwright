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

import net from 'net';
import os from 'os';
import stream from 'stream';
import debug from 'debug';
import { raceAgainstTimeout } from 'playwright-core/lib/utils/async';
import { WebServerConfig } from './types';
import { launchProcess } from 'playwright-core/lib/utils/processLauncher';

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none', // Disable that create-react-app will open the page in the browser
};

const newProcessLogPrefixer = () => new stream.Transform({
  transform(this: stream.Transform, chunk: Buffer, encoding: string, callback: stream.TransformCallback) {
    this.push(chunk.toString().split(os.EOL).map((line: string): string => line ? `[WebServer] ${line}` : line).join(os.EOL));
    callback();
  },
});

const debugWebServer = debug('pw:webserver');

export class WebServer {
  private _killProcess?: () => Promise<void>;
  private _processExitedPromise!: Promise<any>;
  constructor(private readonly config: WebServerConfig) { }

  public static async create(config: WebServerConfig): Promise<WebServer> {
    const webServer = new WebServer(config);
    try {
      await webServer._startProcess();
      await webServer._waitForProcess();
      return webServer;
    } catch (error) {
      await webServer.kill();
      throw error;
    }
  }

  private async _startProcess(): Promise<void> {
    let processExitedReject = (error: Error) => { };
    this._processExitedPromise = new Promise((_, reject) => processExitedReject = reject);

    const portIsUsed = await isPortUsed(this.config.port);
    if (portIsUsed) {
      if (this.config.reuseExistingServer)
        return;
      throw new Error(`Port ${this.config.port} is used, make sure that nothing is running on the port or set strict:false in config.webServer.`);
    }

    const { launchedProcess, kill } = await launchProcess({
      command: this.config.command,
      env: {
        ...DEFAULT_ENVIRONMENT_VARIABLES,
        ...process.env,
        ...this.config.env,
      },
      cwd: this.config.cwd,
      stdio: 'stdin',
      shell: true,
      attemptToGracefullyClose: async () => {},
      log: () => {},
      onExit: code => processExitedReject(new Error(`Process from config.webServer was not able to start. Exit code: ${code}`)),
      tempDirectories: [],
    });
    this._killProcess = kill;

    launchedProcess.stderr!.pipe(newProcessLogPrefixer()).pipe(process.stderr);
    launchedProcess.stdout!.on('data', (line: Buffer) => debugWebServer(line.toString()));
  }

  private async _waitForProcess() {
    await this._waitForAvailability();
    const baseURL = `http://localhost:${this.config.port}`;
    process.env.PLAYWRIGHT_TEST_BASE_URL = baseURL;
  }

  private async _waitForAvailability() {
    const launchTimeout = this.config.timeout || 60 * 1000;
    const cancellationToken = { canceled: false };
    const { timedOut } = (await Promise.race([
      raceAgainstTimeout(() => waitForSocket(this.config.port, 100, cancellationToken), launchTimeout),
      this._processExitedPromise,
    ]));
    cancellationToken.canceled = true;
    if (timedOut)
      throw new Error(`Timed out waiting ${launchTimeout}ms from config.webServer.`);
  }
  public async kill() {
    await this._killProcess?.();
  }
}

async function isPortUsed(port: number): Promise<boolean> {
  const innerIsPortUsed = (host: string) => new Promise<boolean>(resolve => {
    const conn = net
        .connect(port, host)
        .on('error', () => {
          resolve(false);
        })
        .on('connect', () => {
          conn.end();
          resolve(true);
        });
  });
  return await innerIsPortUsed('127.0.0.1') || await innerIsPortUsed('::1');
}

async function waitForSocket(port: number, delay: number, cancellationToken: { canceled: boolean }) {
  while (!cancellationToken.canceled) {
    const connected = await isPortUsed(port);
    if (connected)
      return;
    await new Promise(x => setTimeout(x, delay));
  }
}
