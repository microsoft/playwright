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
/* eslint-disable no-restricted-properties */

import { spawn } from 'child_process';

import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { SocketConnection } from './socketConnection';

import type { FullConfig } from '../browser/config';
import type { SessionConfig, ClientInfo } from './registry';

type MinimistArgs = {
  _: string[];
  [key: string]: any;
};

export class Session {
  readonly name: string;
  readonly config: SessionConfig;
  private _connection: SocketConnection | undefined;
  private _nextMessageId = 1;
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, method: string, params: any }>();
  private _clientInfo: ClientInfo;

  constructor(clientInfo: ClientInfo, options: SessionConfig) {
    this._clientInfo = clientInfo;
    this.config = options;
    this.name = options.name;
  }

  isCompatible(): boolean {
    return this._clientInfo.version === this.config.version;
  }

  checkCompatible() {
    if (!this.isCompatible()) {
      throw new Error(`Client is v${this._clientInfo.version}, session '${this.name}' is v${this.config.version}. Run

  playwright-cli${this.name !== 'default' ? ` -s=${this.name}` : ''} open

to restart the browser session.`);
    }
  }

  async open(): Promise<void> {
    await this._startDaemonIfNeeded();
    this.disconnect();
  }

  async run(args: MinimistArgs, cwd?: string): Promise<{ text: string }> {
    this.checkCompatible();
    const result = await this._send('run', { args, cwd: cwd || process.cwd() });
    this.disconnect();
    return result;
  }

  async stop(quiet: boolean = false): Promise<void> {
    if (!await this.canConnect()) {
      if (!quiet)
        console.log(`Browser '${this.name}' is not open.`);
      return;
    }

    await this._stopDaemon();
    if (!quiet)
      console.log(`Browser '${this.name}' closed\n`);
  }

  private async _send(method: string, params: any = {}): Promise<any> {
    const connection = await this._startDaemonIfNeeded();
    const messageId = this._nextMessageId++;
    const message = {
      id: messageId,
      method,
      params,
      version: this.config.version,
    };
    const responsePromise = new Promise<any>((resolve, reject) => {
      this._callbacks.set(messageId, { resolve, reject, method, params });
    });
    const [result] = await Promise.all([responsePromise, connection.send(message)]);
    return result;
  }

  disconnect() {
    if (!this._connection)
      return;
    for (const callback of this._callbacks.values())
      callback.reject(new Error('Session closed'));
    this._callbacks.clear();
    this._connection.close();
    this._connection = undefined;
  }

  async deleteData() {
    await this.stop();

    const dataDirs = await fs.promises.readdir(this._clientInfo.daemonProfilesDir).catch(() => []);
    const matchingEntries = dataDirs.filter(file => file === `${this.name}.session` || file.startsWith(`ud-${this.name}-`));
    if (matchingEntries.length === 0) {
      console.log(`No user data found for browser '${this.name}'.`);
      return;
    }

    for (const entry of matchingEntries) {
      const userDataDir = path.resolve(this._clientInfo.daemonProfilesDir, entry);
      for (let i = 0; i < 5; i++) {
        try {
          await fs.promises.rm(userDataDir, { recursive: true });
          if (entry.startsWith('ud-'))
            console.log(`Deleted user data for browser '${this.name}'.`);
          break;
        } catch (e: any) {
          if (e.code === 'ENOENT') {
            console.log(`No user data found for browser '${this.name}'.`);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (i === 4)
            throw e;
        }
      }
    }
  }

  async _connect(): Promise<{ socket?: net.Socket, error?: Error }> {
    return await new Promise(resolve => {
      const socket = net.createConnection(this.config.socketPath, () => {
        resolve({ socket });
      });
      socket.on('error', error => {
        if (os.platform() !== 'win32')
          void fs.promises.unlink(this.config.socketPath).catch(() => {}).then(() => resolve({ error }));
        else
          resolve({ error });
      });
    });
  }

  async canConnect(): Promise<boolean> {
    const { socket } = await this._connect();
    if (socket) {
      socket.destroy();
      return true;
    }
    return false;
  }

  private async _startDaemonIfNeeded() {
    if (this._connection)
      return this._connection;

    let { socket } = await this._connect();
    if (!socket)
      socket = await this._startDaemon();

    this._connection = new SocketConnection(socket, this.config.version);
    this._connection.onmessage = message => this._onMessage(message);
    this._connection.onclose = () => this.disconnect();
    return this._connection;
  }

  private _onMessage(object: { id: number, error?: string, result: any }) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.error)
        callback.reject(new Error(object.error));
      else
        callback.resolve(object.result);
    } else if (object.id) {
      throw new Error(`Unexpected message id: ${object.id}`);
    } else {
      throw new Error(`Unexpected message without id: ${JSON.stringify(object)}`);
    }
  }

  private _sessionFile(suffix: string) {
    return path.resolve(this._clientInfo.daemonProfilesDir, `${this.name}${suffix}`);
  }

  private async _startDaemon(): Promise<net.Socket> {
    await fs.promises.mkdir(this._clientInfo.daemonProfilesDir, { recursive: true });
    const cliPath = path.join(__dirname, '../../../cli.js');

    const sessionConfigFile = this._sessionFile('.session');
    this.config.version = this._clientInfo.version;
    this.config.timestamp = Date.now();
    await fs.promises.writeFile(sessionConfigFile, JSON.stringify(this.config, null, 2));

    const errLog = this._sessionFile('.err');
    const err = fs.openSync(errLog, 'w');

    const args = [
      cliPath,
      'run-mcp-server',
      `--daemon-session=${sessionConfigFile}`,
    ];

    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', err],
      cwd: process.cwd(), // Will be used as root.
    });

    let signalled = false;
    const sigintHandler = () => {
      signalled = true;
      child.kill('SIGINT');
    };
    const sigtermHandler = () => {
      signalled = true;
      child.kill('SIGTERM');
    };
    process.on('SIGINT', sigintHandler);
    process.on('SIGTERM', sigtermHandler);

    let outLog = '';
    await new Promise<void>((resolve, reject) => {
      child.stdout!.on('data', data => {
        outLog += data.toString();
        if (!outLog.includes('<EOF>'))
          return;
        const errorMatch = outLog.match(/### Error\n([\s\S]*)<EOF>/);
        const error = errorMatch ? errorMatch[1].trim() : undefined;
        if (error) {
          const errLogContent = fs.readFileSync(errLog, 'utf-8');
          const message = error + (errLogContent ? '\n' + errLogContent : '');
          reject(new Error(message));
        }

        const successMatch = outLog.match(/### Success\nDaemon listening on (.*)\n<EOF>/);
        if (successMatch)
          resolve();
      });
      child.on('close', code => {
        if (!signalled)
          reject(new Error(`Daemon process exited with code ${code}`));
      });
    });

    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigtermHandler);
    child.stdout!.destroy();
    child.unref();

    const { socket } = await this._connect();
    if (socket) {
      console.log(`### Browser \`${this.name}\` opened with pid ${child.pid}.`);
      const resolvedConfig = await parseResolvedConfig(outLog);
      if (resolvedConfig) {
        this.config.resolvedConfig = resolvedConfig;
        console.log(`- ${this.name}:`);
        console.log(renderResolvedConfig(resolvedConfig).join('\n'));
      }
      console.log(`---`);

      this.config.timestamp = Date.now();
      await fs.promises.writeFile(sessionConfigFile, JSON.stringify(this.config, null, 2));
      return socket;
    }

    console.error(`Failed to connect to daemon at ${this.config.socketPath}`);
    process.exit(1);
  }

  private async _stopDaemon(): Promise<void> {
    let error: Error | undefined;
    await this._send('stop').catch(e => { error = e; });
    if (os.platform() !== 'win32')
      await fs.promises.unlink(this.config.socketPath).catch(() => {});

    this.disconnect();
    if (!this.config.cli.persistent)
      await this.deleteSessionConfig();
    if (error && !error?.message?.includes('Session closed'))
      throw error;
  }

  async deleteSessionConfig() {
    await fs.promises.rm(this._sessionFile('.session')).catch(() => {});
  }
}

export function renderResolvedConfig(resolvedConfig: FullConfig) {
  const channel = resolvedConfig.browser.launchOptions.channel ?? resolvedConfig.browser.browserName;
  const lines = [];
  if (channel)
    lines.push(`  - browser-type: ${channel}`);
  if (resolvedConfig.browser.isolated)
    lines.push(`  - user-data-dir: <in-memory>`);
  else
    lines.push(`  - user-data-dir: ${resolvedConfig.browser.userDataDir}`);
  lines.push(`  - headed: ${!resolvedConfig.browser.launchOptions.headless}`);
  return lines;
}

async function parseResolvedConfig(errLog: string): Promise<FullConfig | null> {
  const marker = '### Config\n```json\n';
  const markerIndex = errLog.indexOf(marker);
  if (markerIndex === -1)
    return null;
  const jsonStart = markerIndex + marker.length;
  const jsonEnd = errLog.indexOf('\n```', jsonStart);
  if (jsonEnd === -1)
    throw null;
  const jsonString = errLog.substring(jsonStart, jsonEnd).trim();
  try {
    return JSON.parse(jsonString) as FullConfig;
  } catch {
    return null;
  }
}
