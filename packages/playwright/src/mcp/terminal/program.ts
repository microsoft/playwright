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

import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { debug } from 'playwright-core/lib/utilsBundle';
import { SocketConnection } from './socketConnection';

import type { SpawnOptions } from 'child_process';

const debugCli = debug('pw:cli');

class Session {
  readonly name: string;
  private _connection: SocketConnection;
  private _nextMessageId = 1;
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void }>();

  constructor(name: string, connection: SocketConnection) {
    this.name = name;
    this._connection = connection;
    this._connection.onmessage = message => this._onMessage(message);
    this._connection.onclose = () => this.close();
  }

  async run(args: any): Promise<string> {
    return await this._send('run', { args });
  }

  async stop(): Promise<void> {
    await this._send('stop');
    this.close();
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
      this._callbacks.set(messageId, { resolve, reject });
    });
  }

  close() {
    for (const callback of this._callbacks.values())
      callback.reject(new Error('Session closed'));
    this._callbacks.clear();
    this._connection.close();
  }

  private _onMessage(object: any) {
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
}

class SessionManager {

  async list(): Promise<{ name: string, live: boolean }[]> {
    const dir = daemonSocketDir;
    try {
      const files = await fs.promises.readdir(dir);
      const sessions: { name: string, live: boolean }[] = [];
      for (const file of files) {
        if (file.endsWith('-user-data')) {
          const sessionName = file.slice(0, -'-user-data'.length);
          const live = await this._canConnect(sessionName);
          sessions.push({ name: sessionName, live });
        }
      }
      return sessions;
    } catch {
      return [];
    }
  }

  async run(args: any): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    const session = await this._connect(sessionName);
    const result = await session.run(args);
    console.log(result);
    session.close();
  }

  async stop(sessionName?: string): Promise<void> {
    sessionName = this._resolveSessionName(sessionName);

    if (!await this._canConnect(sessionName)) {
      console.log(`Session '${sessionName}' is not running.`);
      return;
    }

    const session = await this._connect(sessionName);
    await session.stop();
    console.log(`Session '${sessionName}' stopped.`);
  }

  async delete(sessionName?: string): Promise<void> {
    sessionName = this._resolveSessionName(sessionName);

    // Stop the session if it's running
    if (await this._canConnect(sessionName)) {
      const session = await this._connect(sessionName);
      await session.stop();
    }

    // Delete user data directory
    const userDataDir = path.resolve(daemonSocketDir, `${sessionName}-user-data`);
    try {
      await fs.promises.rm(userDataDir, { recursive: true });
      console.log(`Deleted user data for session '${sessionName}'.`);
    } catch (e: any) {
      if (e.code === 'ENOENT')
        console.log(`No user data found for session '${sessionName}'.`);
      else
        throw e;

    }

    // Also try to delete the socket file if it exists
    if (os.platform() !== 'win32') {
      const socketPath = this._daemonSocketPath(sessionName);
      await fs.promises.unlink(socketPath).catch(() => {});
    }
  }

  private async _connect(sessionName: string): Promise<Session> {
    const socketPath = process.env.PLAYWRIGHT_DAEMON_SOCKET_PATH || this._daemonSocketPath(sessionName);
    debugCli(`Connecting to daemon at ${socketPath}`);

    const socketExists = await fs.promises.stat(socketPath)
        .then(stat => stat?.isSocket() ?? false)
        .catch(() => false);

    if (socketExists) {
      debugCli(`Socket file exists, attempting to connect...`);
      try {
        return await this._connectToSocket(sessionName, socketPath);
      } catch (e) {
        // Connection failed, delete the stale socket file.
        if (os.platform() !== 'win32')
          await fs.promises.unlink(socketPath).catch(() => {});
      }
    }

    if (process.env.PLAYWRIGHT_DAEMON_SOCKET_PATH)
      throw new Error(`Socket path ${socketPath} does not exist`);

    const userDataDir = path.resolve(daemonSocketDir, `${sessionName}-user-data`);
    const child = spawnDaemon(socketPath, userDataDir, {
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
        return await this._connectToSocket(sessionName, socketPath);
      } catch (e) {
        if (e.code !== 'ENOENT')
          throw e;
        debugCli(`Retrying to connect to daemon at ${socketPath} (${i + 1}/${maxRetries})`);
      }
    }
    throw new Error(`Failed to connect to daemon at ${socketPath} after ${maxRetries * retryDelay}ms`);
  }

  private async _connectToSocket(sessionName: string, socketPath: string): Promise<Session> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(socketPath, () => {
        debugCli(`Connected to daemon at ${socketPath}`);
        resolve(socket);
      });
      socket.on('error', reject);
    });
    return new Session(sessionName, new SocketConnection(socket));
  }

  private async _canConnect(sessionName: string): Promise<boolean> {
    const socketPath = this._daemonSocketPath(sessionName);
    return new Promise<boolean>(resolve => {
      const socket = net.createConnection(socketPath, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        resolve(false);
      });
    });
  }

  private _resolveSessionName(sessionName?: string): string {
    if (sessionName)
      return sessionName;
    if (process.env.PLAYWRIGHT_CLI_SESSION)
      return process.env.PLAYWRIGHT_CLI_SESSION;
    return 'default';
  }

  private _daemonSocketPath(sessionName: string): string {
    const socketName = `${sessionName}.sock`;
    if (os.platform() === 'win32')
      return `\\\\.\\pipe\\${socketDirHash}-${socketName}`;
    return path.join(daemonSocketDir, socketName);
  }
}

async function handleSessionCommand(sessionManager: SessionManager, args: any): Promise<void> {
  const subcommand = args._[0].split('-').slice(1).join('-');

  if (subcommand === 'list') {
    const sessions = await sessionManager.list();
    console.log('Sessions:');
    for (const session of sessions) {
      const liveMarker = session.live ? ' (live)' : '';
      console.log(`  ${session.name}${liveMarker}`);
    }
    if (sessions.length === 0)
      console.log('  (no sessions)');
    return;
  }

  if (subcommand === 'stop') {
    await sessionManager.stop(args._[1]);
    return;
  }

  if (subcommand === 'stop-all') {
    const sessions = await sessionManager.list();
    for (const session of sessions)
      await sessionManager.stop(session.name);
    return;
  }

  if (subcommand === 'delete') {
    await sessionManager.delete(args._[1]);
    return;
  }

  console.error(`Unknown session subcommand: ${subcommand}`);
  process.exit(1);
}

const socketDirHash = (() => {
  const hash = crypto.createHash('sha1');
  hash.update(require.resolve('../../../package.json'));
  return hash.digest('hex');
})();

const daemonSocketDir = (() => {
  let localCacheDir: string | undefined;
  if (process.platform === 'linux')
    localCacheDir = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    localCacheDir = path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    localCacheDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  if (!localCacheDir)
    throw new Error('Unsupported platform: ' + process.platform);
  return path.join(localCacheDir, 'ms-playwright', 'daemon', 'daemon', socketDirHash);
})();

function spawnDaemon(socketPath: string, userDataDir: string, options: SpawnOptions) {
  const cliPath = path.join(__dirname, '../../../cli.js');
  debugCli(`Will launch daemon process: ${cliPath}`);
  return spawn(process.execPath, [cliPath, 'run-mcp-server', `--daemon=${socketPath}`, `--user-data-dir=${userDataDir}`], options);
}

export async function program(options: { version: string }) {
  const argv = process.argv.slice(2);
  const args = require('minimist')(argv);
  const help = require('./help.json');
  const commandName = args._[0];

  if (args.version || args.v) {
    console.log(options.version);
    process.exit(0);
  }

  const command = help.commands[commandName];
  if (args.help || args.h) {
    if (command) {
      console.log(command);
    } else {
      console.log('playwright-cli - run playwright mcp commands from terminal\n');
      console.log(help.global);
    }
    process.exit(0);
  }
  if (!command) {
    console.error(`Unknown command: ${commandName}\n`);
    console.log(help.global);
    process.exit(1);
  }

  const sessionManager = new SessionManager();
  if (commandName.startsWith('session')) {
    await handleSessionCommand(sessionManager, args);
    return;
  }

  await sessionManager.run(args);
}
