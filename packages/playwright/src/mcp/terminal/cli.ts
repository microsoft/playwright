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

import type * as mcp from '../sdk/exports';

const debugCli = debug('pw:cli');

const packageJSON = require('../../../package.json');

async function runCliCommand(sessionName: string, args: any) {
  const session = await connectToDaemon(sessionName);
  const result = await session.runCliCommand(args);
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
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void }>();

  constructor(connection: SocketConnection) {
    this._connection = connection;
    this._connection.onmessage = message => this._onMessage(message);
    this._connection.onclose = () => this.dispose();
  }

  async callTool(name: string, args: mcp.CallToolRequest['params']['arguments']): Promise<mcp.CallToolResult> {
    return this._send(name, args);
  }

  async runCliCommand(args: any): Promise<string> {
    return await this._send('runCliCommand', { args });
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

  dispose() {
    for (const callback of this._callbacks.values())
      callback.reject(new Error('Disposed'));
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

function localCacheDir(): string {
  if (process.platform === 'linux')
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  throw new Error('Unsupported platform: ' + process.platform);
}

function playwrightCacheDir(): string {
  return path.join(localCacheDir(), 'ms-playwright');
}

function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

function socketDirHash(): string {
  return calculateSha1(__dirname);
}

function daemonSocketDir(): string {
  return path.resolve(playwrightCacheDir(), 'daemon', socketDirHash());
}

function daemonSocketPath(sessionName: string): string {
  const socketName = `${sessionName}.sock`;
  if (os.platform() === 'win32')
    return `\\\\.\\pipe\\${socketDirHash()}-${socketName}`;
  return path.resolve(daemonSocketDir(), socketName);
}

async function connectToDaemon(sessionName: string): Promise<SocketSession> {
  const socketPath = daemonSocketPath(sessionName);
  debugCli(`Connecting to daemon at ${socketPath}`);

  if (await socketExists(socketPath)) {
    debugCli(`Socket file exists, attempting to connect...`);
    try {
      return await connectToSocket(socketPath);
    } catch (e) {
      // Connection failed, delete the stale socket file.
      if (os.platform() !== 'win32')
        await fs.promises.unlink(socketPath).catch(() => {});
    }
  }

  const cliPath = path.join(__dirname, '../../../cli.js');
  debugCli(`Will launch daemon process: ${cliPath}`);

  const userDataDir = path.resolve(daemonSocketDir(), `${sessionName}-user-data`);
  const child = spawn(process.execPath, [cliPath, 'run-mcp-server', `--daemon=${socketPath}`, `--user-data-dir=${userDataDir}`], {
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

function currentSessionPath(): string {
  return path.resolve(daemonSocketDir(), 'current-session');
}

async function getCurrentSession(): Promise<string> {
  try {
    const session = await fs.promises.readFile(currentSessionPath(), 'utf-8');
    return session.trim() || 'default';
  } catch {
    return 'default';
  }
}

async function setCurrentSession(sessionName: string): Promise<void> {
  await fs.promises.mkdir(daemonSocketDir(), { recursive: true });
  await fs.promises.writeFile(currentSessionPath(), sessionName);
}

async function canConnectToSocket(socketPath: string): Promise<boolean> {
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

async function listSessions(): Promise<{ name: string, live: boolean }[]> {
  const dir = daemonSocketDir();
  try {
    const files = await fs.promises.readdir(dir);
    const sessions: { name: string, live: boolean }[] = [];
    for (const file of files) {
      if (file.endsWith('-user-data')) {
        const sessionName = file.slice(0, -'-user-data'.length);
        const socketPath = daemonSocketPath(sessionName);
        const live = await canConnectToSocket(socketPath);
        sessions.push({ name: sessionName, live });
      }
    }
    return sessions;
  } catch {
    return [];
  }
}

function resolveSessionName(args: any): string {
  if (args.session)
    return args.session;
  if (process.env.PLAYWRIGHT_CLI_SESSION)
    return process.env.PLAYWRIGHT_CLI_SESSION;
  return 'default';
}

async function handleSessionCommand(args: any): Promise<void> {
  const subcommand = args._[1];

  if (!subcommand) {
    // Show current session
    const current = await getCurrentSession();
    console.log(current);
    return;
  }

  if (subcommand === 'list') {
    const sessions = await listSessions();
    const current = await getCurrentSession();
    console.log('Sessions:');
    for (const session of sessions) {
      const marker = session.name === current ? '->' : '  ';
      const liveMarker = session.live ? ' (live)' : '';
      console.log(`${marker} ${session.name}${liveMarker}`);
    }
    if (sessions.length === 0)
      console.log('   (no sessions)');
    return;
  }

  if (subcommand === 'set') {
    const sessionName = args._[2];
    if (!sessionName) {
      console.error('Usage: playwright-cli session set <session-name>');
      process.exit(1);
    }
    await setCurrentSession(sessionName);
    console.log(`Current session set to: ${sessionName}`);
    return;
  }

  console.error(`Unknown session subcommand: ${subcommand}`);
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = require('minimist')(argv);
  const help = require('./help.json');
  const commandName = args._[0];

  if (args.version || args.v) {
    console.log(packageJSON.version);
    process.exit(0);
  }

  // Handle 'session' command specially - it doesn't need daemon connection
  if (commandName === 'session') {
    await handleSessionCommand(args);
    return;
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

  // Resolve session name: --session flag > PLAYWRIGHT_CLI_SESSION env > current session > 'default'
  let sessionName = resolveSessionName(args);
  if (sessionName === 'default' && !args.session && !process.env.PLAYWRIGHT_CLI_SESSION)
    sessionName = await getCurrentSession();

  runCliCommand(sessionName, args).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
