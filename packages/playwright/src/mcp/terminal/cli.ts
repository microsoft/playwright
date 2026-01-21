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

import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { debug } from 'playwright-core/lib/utilsBundle';
import { SocketConnection } from './socketConnection';
import { aliases, globalHelp, helpMessage } from './commands';

import type * as mcp from '../sdk/exports';

const debugCli = debug('pw:cli');

const packageJSON = require('../../../package.json');

async function runMcpCommand(argv: string[], options: { headless?: boolean } = {}) {
  const session = await connectToDaemon(options);
  const result = await session.runCliCommand(argv);
  console.log(result);
  session.dispose();
}

async function socketExists(socketPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(socketPath);
    if (stat?.isSocket())
      return true;
  } catch (e) {
  }
  return false;
}

class SocketSession {
  private _connection: SocketConnection;
  private _nextMessageId = 1;
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, error: Error }>();

  constructor(connection: SocketConnection) {
    this._connection = connection;
    this._connection.onmessage = message => this._onMessage(message);
    this._connection.onclose = () => this.dispose();
  }


  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    return this._send(name, args);
  }

  async runCliCommand(argv: string[]): Promise<string> {
    return await this._send('runCliCommand', { argv });
  }

  private async _send(method: string, params: any = {}): Promise<any> {
    const messageId = this._nextMessageId++;
    const message = {
      id: messageId,
      method,
      params,
    };
    await this._connection.send(message);
    return new Promise<any>((resolve, reject) => {
      this._callbacks.set(messageId, { resolve, reject, error: new Error(`Error in method: ${method}`) });
    });
  }

  dispose() {
    for (const callback of this._callbacks.values())
      callback.reject(callback.error);
    this._callbacks.clear();
    this._connection.close();
  }

  private _onMessage(object: any) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.error) {
        callback.error.cause = new Error(object.error);
        callback.reject(callback.error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id) {
      throw new Error(`Unexpected message id: ${object.id}`);
    } else {
      throw new Error(`Unexpected message without id: ${JSON.stringify(object)}`);
    }
  }
}

function playwrightCacheDir(): string {
  if (process.platform === 'linux')
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  throw new Error('Unsupported platform: ' + process.platform);
}

function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

function daemonSocketPath(): string {
  const installationDir = path.join(__dirname, '..', '..', '..');
  const socketDir = calculateSha1(installationDir);
  const socketName = 'default.sock';
  if (os.platform() === 'win32')
    return `\\\\.\\pipe\\${socketDir}-${socketName}`;
  return path.resolve(playwrightCacheDir(), 'daemon', socketDir, socketName);
}

async function connectToDaemon(options: { headless?: boolean }): Promise<SocketSession> {
  const socketPath = daemonSocketPath();
  debugCli(`Connecting to daemon at ${socketPath}`);

  if (await socketExists(socketPath)) {
    debugCli(`Socket file exists, attempting to connect...`);
    try {
      return await connectToSocket(socketPath);
    } catch (e) {
      // Connection failed, delete the stale socket file.
      fs.unlinkSync(socketPath);
    }
  }

  const cliPath = path.join(__dirname, '../../../cli.js');
  debugCli(`Will launch daemon process: ${cliPath}`);
  const child = spawn(process.execPath, [cliPath, 'run-mcp-server', `--daemon=${socketPath}`, ...(options.headless ? ['--headless'] : [])], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(), // Will be used as root.
  });
  child.unref();

  // Wait for the socket to become available with retries.
  const maxRetries = 50;
  const retryDelay = 100; // ms
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      return await connectToSocket(socketPath);
    } catch (e) {
      if (e.code !== 'ENOENT')
        throw e;
      debugCli(`Retrying to connect to daemon at ${socketPath} (${i + 1}/${maxRetries})`);
    }
  }
  throw new Error(`Failed to connect to daemon at ${socketPath} after ${maxRetries * retryDelay}ms`);
}

async function connectToSocket(socketPath: string): Promise<SocketSession> {
  const socket = await new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => {
      debugCli(`Connected to daemon at ${socketPath}`);
      resolve(socket);
    });
    socket.on('error', reject);
  });
  return new SocketSession(new SocketConnection(socket));
}

function main() {
  const argv = process.argv.slice(2);
  const args = require('minimist')(argv);
  const command = args._[0];
  if (args.help || args.h || !command) {
    // case of '--help navigate'
    const commandName = command ?? args.help ?? args.h;
    if (commandName && commandName in helpMessage)
      console.log(helpMessage[commandName]);
    else
      console.log(globalHelp);
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  }

  if (args.version || args.v) {
    console.log(packageJSON.version);
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  }
  const options: any = { };
  if (command === 'navigate' || aliases['navigate'].includes(command))
    options.headless = !args.headed;
  runMcpCommand(argv, options).catch(e => {
    console.error(e.message);
    // eslint-disable-next-line no-restricted-properties
    process.exit(1);
  });
}

main();
