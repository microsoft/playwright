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
import { SocketConnection } from './socketConnection';

import type { Section } from '../browser/response';

export type StructuredResponse = {
  isError?: boolean;
  text?: string;
  sections: Section[];
};

type SessionOptions = {
  config?: string;
  headed?: boolean;
  extension?: boolean;
  daemonVersion: string;
  browser?: string;
  isolated?: boolean;
};

class Session {
  readonly name: string;
  private _socketPath: string;
  private _connection: SocketConnection | undefined;
  private _nextMessageId = 1;
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, method: string, params: any }>();
  private _options: SessionOptions;

  constructor(name: string, options: SessionOptions) {
    this.name = name;
    this._socketPath = this._daemonSocketPath();
    this._options = options;
  }

  async run(args: any) {
    return await this._send('run', { args, cwd: process.cwd() });
  }

  async stop(): Promise<void> {
    if (!await this.canConnect()) {
      console.log(`Session '${this.name}' is not running.`);
      return;
    }

    await this._send('stop').catch(e => {
      if (e.message !== 'Session closed')
        throw e;
    });
    this.close();

    if (os.platform() !== 'win32')
      await fs.promises.unlink(this._socketPath).catch(() => {});
    console.log(`Session '${this.name}' stopped.`);
  }

  async restart(options: SessionOptions): Promise<void> {
    await this.stop();

    this._options = options;
    await this._startDaemonIfNeeded();
  }

  private async _send(method: string, params: any = {}): Promise<any> {
    const connection = await this._startDaemonIfNeeded();
    const messageId = this._nextMessageId++;
    const message = {
      id: messageId,
      method,
      params,
      version: this._options.daemonVersion,
    };
    const responsePromise = new Promise<any>((resolve, reject) => {
      this._callbacks.set(messageId, { resolve, reject, method, params });
    });
    const [result] = await Promise.all([responsePromise, connection.send(message)]);
    return result;
  }

  close() {
    if (!this._connection)
      return;
    for (const callback of this._callbacks.values())
      callback.reject(new Error('Session closed'));
    this._callbacks.clear();
    this._connection.close();
    this._connection = undefined;
  }

  async delete() {
    await this.stop();

    const dataDirs = await fs.promises.readdir(daemonProfilesDir).catch(() => []);
    const matchingEntries = dataDirs.filter(file => file === `${this.name}.session` || file.startsWith(`ud-${this.name}-`));
    if (matchingEntries.length === 0) {
      console.log(`No user data found for session '${this.name}'.`);
      return;
    }

    for (const dir of matchingEntries) {
      const userDataDir = path.resolve(daemonProfilesDir, dir);
      for (let i = 0; i < 5; i++) {
        try {
          await fs.promises.rm(userDataDir, { recursive: true });
          console.log(`Deleted user data for session '${this.name}'.`);
          break;
        } catch (e: any) {
          if (e.code === 'ENOENT') {
            console.log(`No user data found for session '${this.name}'.`);
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
      const socket = net.createConnection(this._socketPath, () => {
        resolve({ socket });
      });
      socket.on('error', error => {
        if (os.platform() !== 'win32')
          void fs.promises.unlink(this._socketPath).catch(() => {}).then(() => resolve({ error }));
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

    this._connection = new SocketConnection(socket, this._options.daemonVersion);
    this._connection.onmessage = message => this._onMessage(message);
    this._connection.onversionerror = (id, e) => {
      if (e.received && e.received !== 'undefined-for-test') {
        // This is daemon telling us the version is bad.
        return false;
      }

      // This will only happen once when hitting the non-versione-aware daemon.
      // Only kill daemon if it is older.
      console.error(`Daemon is older than client, killing it.`);
      this.stop().then(() => process.exit(1)).catch(() => process.exit(1));
      return true;
    };
    this._connection.onclose = () => this.close();
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

  private async _startDaemon(): Promise<net.Socket> {
    await fs.promises.mkdir(daemonProfilesDir, { recursive: true });
    const userDataDir = path.resolve(daemonProfilesDir, `ud-${this.name}`);
    const cliPath = path.join(__dirname, '../../../cli.js');
    const configFile = resolveConfigFile(this._options.config);
    const configArg = configFile !== undefined ? [`--config=${configFile}`] : [];
    const headedArg = this._options.headed ? [`--daemon-headed`] : [];
    const extensionArg = this._options.extension ? [`--extension`] : [];
    const isolatedArg = this._options.isolated ? [`--isolated`] : [];
    const browserArg = this._options.browser ? [`--browser=${this._options.browser}`] : [];

    const sessionOptionsFile = path.resolve(daemonProfilesDir, `${this.name}.session`);
    await fs.promises.writeFile(sessionOptionsFile, JSON.stringify({ ...this._options, _: undefined }, null, 2));

    const outLog = path.join(daemonProfilesDir, 'out.log');
    const errLog = path.join(daemonProfilesDir, 'err.log');
    const out = fs.openSync(outLog, 'w');
    const err = fs.openSync(errLog, 'w');

    const child = spawn(process.execPath, [
      cliPath,
      'run-mcp-server',
      `--output-dir=${outputDir}`,
      `--daemon=${this._socketPath}`,
      `--daemon-data-dir=${userDataDir}`,
      `--daemon-version=${this._options.daemonVersion}`,
      ...configArg,
      ...headedArg,
      ...extensionArg,
      ...isolatedArg,
      ...browserArg,
    ], {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(), // Will be used as root.
    });
    child.unref();

    console.log(`<!-- Daemon for \`${this.name}\` session started with pid ${child.pid}.`);
    if (configFile)
      console.log(`- Using config file at \`${path.relative(process.cwd(), configFile)}\`.`);
    const sessionSuffix = this.name !== 'default' ? ` "${this.name}"` : '';
    console.log(`- You can stop the session daemon with \`playwright-cli session-stop${sessionSuffix}\` when done.`);
    console.log(`- You can delete the session data with \`playwright-cli session-delete${sessionSuffix}\` when done.`);
    console.log('-->');

    // Wait for the socket to become available with retries.
    const maxRetries = 50;
    const retryDelay = 100; // ms
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      try {
        const { socket } = await this._connect();
        if (socket)
          return socket;
      } catch (e) {
        if (e.code !== 'ENOENT' && e.code !== 'ECONNREFUSED')
          throw e;
      }
    }

    const outData = await fs.promises.readFile(outLog, 'utf-8').catch(() => '');
    const errData = await fs.promises.readFile(errLog, 'utf-8').catch(() => '');

    console.error(`Failed to connect to daemon at ${this._socketPath} after ${maxRetries * retryDelay}ms`);
    if (outData.length)
      console.log(outData);
    if (errData.length)
      console.error(errData);
    process.exit(1);
  }

  private _daemonSocketPath(): string {
    const socketName = `${this.name}.sock`;
    if (os.platform() === 'win32')
      return `\\\\.\\pipe\\${installationDirHash}-${socketName}`;
    const socketsDir = process.env.PLAYWRIGHT_DAEMON_SOCKETS_DIR || path.join(os.tmpdir(), 'playwright-cli');
    return path.join(socketsDir, installationDirHash, socketName);
  }
}

class SessionManager {
  readonly sessions: Map<string, Session>;
  readonly options: SessionOptions;

  private constructor(sessions: Map<string, Session>, options: SessionOptions) {
    this.sessions = sessions;
    this.options = options;
  }

  static async create(options: SessionOptions): Promise<SessionManager> {
    const dir = daemonProfilesDir;
    const sessions = new Map<string, Session>([
      ['default', new Session('default', options)],
    ]);
    const files = await fs.promises.readdir(dir).catch(() => []);
    for (const file of files) {
      try {
        if (file.endsWith('.session')) {
          const sessionName = path.basename(file, '.session');
          sessions.set(sessionName, new Session(sessionName, options));
          continue;
        }

        // Legacy session support.
        if (file.startsWith('ud-')) {
          // Session is like ud-<sessionName>-browserName
          const sessionName = file.split('-')[1];
          if (!sessions.has(sessionName))
            sessions.set(sessionName, new Session(sessionName, options));
        }
      } catch {
      }
    }
    return new SessionManager(sessions, options);
  }

  async run(args: any): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    let session = this.sessions.get(sessionName);
    if (!session) {
      session = new Session(sessionName, { ...this.options, ...args });
      this.sessions.set(sessionName, session);
    }

    const result = await session.run(args);
    console.log(result.text);
    session.close();
  }

  async stop(sessionName?: string): Promise<void> {
    sessionName = this._resolveSessionName(sessionName);
    const session = this.sessions.get(sessionName);
    if (!session || !await session.canConnect()) {
      console.log(`Session '${sessionName}' is not running.`);
      return;
    }

    await session.stop();
  }

  async delete(sessionName?: string): Promise<void> {
    sessionName = this._resolveSessionName(sessionName);
    const session = this.sessions.get(sessionName);
    if (!session) {
      console.log(`No user data found for session '${sessionName}'.`);
      return;
    }
    await session.delete();
    this.sessions.delete(sessionName);
  }

  async configure(args: any): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    let session = this.sessions.get(sessionName);
    if (!session) {
      session = new Session(sessionName, this.options);
      this.sessions.set(sessionName, session);
    }
    await session.restart({ ...this.options, ...args });
    session.close();
  }

  private _resolveSessionName(sessionName?: string): string {
    if (sessionName)
      return sessionName;
    if (process.env.PLAYWRIGHT_CLI_SESSION)
      return process.env.PLAYWRIGHT_CLI_SESSION;
    return 'default';
  }
}

async function handleSessionCommand(sessionManager: SessionManager, subcommand: string, args: any): Promise<void> {
  if (subcommand === 'list') {
    const sessions = sessionManager.sessions;
    console.log('Sessions:');
    for (const session of sessions.values()) {
      const liveMarker = await session.canConnect() ? ' (live)' : '';
      console.log(`  ${session.name}${liveMarker}`);
    }
    if (sessions.size === 0)
      console.log('  (no sessions)');
    return;
  }

  if (subcommand === 'stop') {
    await sessionManager.stop(args._[1]);
    return;
  }

  if (subcommand === 'stop-all') {
    const sessions = sessionManager.sessions;
    for (const session of sessions.values())
      await session.stop();
    return;
  }

  if (subcommand === 'delete') {
    await sessionManager.delete(args._[1]);
    return;
  }

  if (subcommand === 'config') {
    await sessionManager.configure(args);
    return;
  }

  console.error(`Unknown session subcommand: ${subcommand}`);
  process.exit(1);
}

const installationDirHash = (() => {
  const hash = crypto.createHash('sha1');
  hash.update(process.env.PLAYWRIGHT_DAEMON_INSTALL_DIR || require.resolve('../../../package.json'));
  return hash.digest('hex').substring(0, 16);
})();

const daemonProfilesDir = (() => {
  if (process.env.PLAYWRIGHT_DAEMON_SESSION_DIR)
    return process.env.PLAYWRIGHT_DAEMON_SESSION_DIR;

  let localCacheDir: string | undefined;
  if (process.platform === 'linux')
    localCacheDir = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    localCacheDir = path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    localCacheDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  if (!localCacheDir)
    throw new Error('Unsupported platform: ' + process.platform);
  return path.join(localCacheDir, 'ms-playwright', 'daemon', installationDirHash);
})();

const booleanOptions = [
  'extension',
  'headed',
  'help',
  'isolated',
  'version',
];

export async function program(options: { version: string }) {
  const argv = process.argv.slice(2);
  const args = require('minimist')(argv, { boolean: booleanOptions });
  for (const option of booleanOptions) {
    if (!argv.includes(`--${option}`) && !argv.includes(`--no-${option}`))
      delete args[option];
  }

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

  const sessionManager = await SessionManager.create({ daemonVersion: options.version, ...args });
  if (commandName.startsWith('session')) {
    const subcommand = args._[0].split('-').slice(1).join('-');
    await handleSessionCommand(sessionManager, subcommand, args);
    return;
  }

  if (commandName === 'config') {
    await handleSessionCommand(sessionManager, 'config', args);
    return;
  }

  if (commandName === 'close') {
    await handleSessionCommand(sessionManager, 'stop', args);
    return;
  }

  await sessionManager.run(args);
}

const outputDir = path.join(process.cwd(), '.playwright-cli');

function resolveConfigFile(configParam: string | undefined) {
  const configFile = configParam || process.env.PLAYWRIGHT_CLI_CONFIG;
  if (configFile)
    return path.resolve(process.cwd(), configFile);

  try {
    if (fs.existsSync(path.resolve(process.cwd(), 'playwright-cli.json')))
      return path.resolve(process.cwd(), 'playwright-cli.json');
  } catch {
  }
  return undefined;
}
