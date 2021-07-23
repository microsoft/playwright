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

import net from 'net';
import os from 'os';
import stream from 'stream';
import { monotonicTime, raceAgainstDeadline } from './util';
import { LaunchConfig } from '../../types/test';
import { launchProcess } from '../utils/processLauncher';

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none', // Disable that create-react-app will open the page in the browser
};

const newProcessLogPrefixer = () => new stream.Transform({
  transform(this: stream.Transform, chunk: Buffer, encoding: string, callback: stream.TransformCallback) {
    this.push(chunk.toString().split(os.EOL).map((line: string): string => line ? `[Launch] ${line}` : line).join(os.EOL));
    callback();
  },
});

class LaunchServer {
  private _killProcess?: () => Promise<void>;
  private _processExitedPromise!: Promise<any>;
  constructor(private readonly config: LaunchConfig) { }

  public static async create(config: LaunchConfig): Promise<LaunchServer> {
    const launchServer = new LaunchServer(config);
    try {
      await launchServer._startProcess();
      await launchServer._waitForProcess();
      return launchServer;
    } catch (error) {
      await launchServer.kill();
      throw error;
    }
  }

  private async _startProcess(): Promise<void> {
    let processExitedReject = (error: Error) => { };
    this._processExitedPromise = new Promise((_, reject) => processExitedReject = reject);

    if (this.config.waitForPort) {
      const portIsUsed = !await canBindPort(this.config.waitForPort);
      if (portIsUsed && this.config.strict)
        throw new Error(`Port ${this.config.waitForPort} is used, make sure that nothing is running on the port or set strict:false in config.launch.`);
      if (portIsUsed)
        return;
    }

    console.log(`Launching '${this.config.command}'...`);
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
      onExit: code => processExitedReject(new Error(`Process from config.launch was not able to start. Exit code: ${code}`)),
      tempDirectories: [],
    });
    this._killProcess = kill;

    launchedProcess.stderr.pipe(newProcessLogPrefixer()).pipe(process.stderr);
    launchedProcess.stdout.on('data', () => {});
  }

  private async _waitForProcess() {
    if (this.config.waitForPort) {
      await this._waitForAvailability(this.config.waitForPort);
      const baseURL = `http://localhost:${this.config.waitForPort}`;
      process.env.PLAYWRIGHT_TEST_BASE_URL = baseURL;
      console.log(`Using baseURL '${baseURL}' from config.launch.`);
    }
  }

  private async _waitForAvailability(port: number) {
    const launchTimeout = this.config.waitForPortTimeout || 60 * 1000;
    const cancellationToken = { canceled: false };
    const { timedOut } = (await Promise.race([
      raceAgainstDeadline(waitForSocket(port, 100, cancellationToken), launchTimeout + monotonicTime()),
      this._processExitedPromise,
    ]));
    cancellationToken.canceled = true;
    if (timedOut)
      throw new Error(`Timed out waiting ${launchTimeout}ms from config.launch.`);
  }
  public async kill() {
    await this._killProcess?.();
  }
}

async function canBindPort(port: number): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const server = net.createServer();
    server.on('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
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

export class LaunchServers {
  private readonly _servers: LaunchServer[] = [];

  public static async create(configs: LaunchConfig[]): Promise<LaunchServers> {
    const launchServers = new LaunchServers();
    try {
      for (const config of configs)
        launchServers._servers.push(await LaunchServer.create(config));
    } catch (error) {
      for (const server of launchServers._servers)
        await server.kill();
      throw error;
    }
    return launchServers;
  }

  public async killAll() {
    for (const server of this._servers)
      await server.kill();
  }
}
