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

type MinimistArgs = {
  _: string[];
  [key: string]: any;
};

export type SessionConfig = {
  version: string;
  socketPath: string;
  cli: {
    headed?: boolean;
    extension?: boolean;
    browser?: string;
    isolated?: boolean;
    config?: string;
  };
  userDataDirPrefix?: string;
};

class Session {
  readonly name: string;
  private _connection: SocketConnection | undefined;
  private _nextMessageId = 1;
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, method: string, params: any }>();
  private _config: SessionConfig;
  private _clientVersion: string;

  constructor(clientVersion: string, name: string, options: SessionConfig) {
    this.name = name;
    this._clientVersion = clientVersion;
    this._config = options;
  }

  config(): SessionConfig {
    return this._config;
  }

  isCompatible(): boolean {
    return this._clientVersion === this._config.version;
  }

  checkCompatible() {
    if (!this.isCompatible()) {
      throw new Error(`Client is v${this._clientVersion}, session '${this.name}' is v${this._config.version}. Run

  playwright-cli session-restart${this.name !== 'default' ? ` ${this.name}` : ''}

to restart the session daemon.`);
    }
  }

  async run(args: MinimistArgs) {
    this.checkCompatible();
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
      await fs.promises.unlink(this._config.socketPath).catch(() => {});
    console.log(`Session '${this.name}' stopped.`);
  }

  async restart(config: SessionConfig): Promise<void> {
    await this.stop();
    this._config = config;
    await this._startDaemonIfNeeded();
  }

  private async _send(method: string, params: any = {}): Promise<any> {
    const connection = await this._startDaemonIfNeeded();
    const messageId = this._nextMessageId++;
    const message = {
      id: messageId,
      method,
      params,
      version: this._config.version,
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

    for (const entry of matchingEntries) {
      const userDataDir = path.resolve(daemonProfilesDir, entry);
      for (let i = 0; i < 5; i++) {
        try {
          await fs.promises.rm(userDataDir, { recursive: true });
          if (entry.startsWith('ud-'))
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
      const socket = net.createConnection(this._config.socketPath, () => {
        resolve({ socket });
      });
      socket.on('error', error => {
        if (os.platform() !== 'win32')
          void fs.promises.unlink(this._config.socketPath).catch(() => {}).then(() => resolve({ error }));
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

    this._connection = new SocketConnection(socket, this._config.version);
    this._connection.onmessage = message => this._onMessage(message);
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
    const cliPath = path.join(__dirname, '../../../cli.js');

    const sessionConfigFile = path.resolve(daemonProfilesDir, `${this.name}.session`);
    this._config.version = this._clientVersion;
    await fs.promises.writeFile(sessionConfigFile, JSON.stringify(this._config, null, 2));

    const outLog = path.join(daemonProfilesDir, 'out.log');
    const errLog = path.join(daemonProfilesDir, 'err.log');
    const out = fs.openSync(outLog, 'w');
    const err = fs.openSync(errLog, 'w');

    const args = [
      cliPath,
      'run-mcp-server',
      `--output-dir=${outputDir}`,
      `--daemon-session=${sessionConfigFile}`,
    ];

    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(), // Will be used as root.
    });
    child.unref();

    console.log(`<!-- Daemon for \`${this.name}\` session started with pid ${child.pid}.`);
    if (this._config.cli.config)
      console.log(`- Using config file at \`${path.relative(process.cwd(), this._config.cli.config)}\`.`);
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

    console.error(`Failed to connect to daemon at ${this._config.socketPath} after ${maxRetries * retryDelay}ms`);
    if (outData.length)
      console.log(outData);
    if (errData.length)
      console.error(errData);
    process.exit(1);
  }
}

class SessionManager {
  readonly clientVersion: string;
  readonly sessions: Map<string, Session>;

  private constructor(clientVersion: string, sessions: Map<string, Session>, args: MinimistArgs) {
    this.clientVersion = clientVersion;
    this.sessions = sessions;
  }

  static async create(clientVersion: string, args: MinimistArgs): Promise<SessionManager> {
    const dir = daemonProfilesDir;
    const sessions = new Map<string, Session>();
    const files = await fs.promises.readdir(dir).catch(() => []);
    for (const file of files) {
      try {
        if (file.endsWith('.session')) {
          const sessionName = path.basename(file, '.session');
          const sessionConfig = await fs.promises.readFile(path.join(dir, file), 'utf-8').then(data => JSON.parse(data)) as SessionConfig;
          sessions.set(sessionName, new Session(clientVersion, sessionName, sessionConfig));
          continue;
        }

        // Legacy session support.
        if (file.startsWith('ud-')) {
          // Session is like ud-<sessionName>-browserName
          const sessionName = file.split('-')[1];
          if (!sessions.has(sessionName)) {
            const sessionConfig = sessionConfigFromArgs('0.0.61', sessionName, { _: [] });
            sessions.set(sessionName, new Session(clientVersion, sessionName, sessionConfig));
          }
        }
      } catch {
      }
    }
    return new SessionManager(clientVersion, sessions, args);
  }

  async run(args: MinimistArgs): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    let session = this.sessions.get(sessionName);
    if (!session) {
      session = new Session(this.clientVersion, sessionName, sessionConfigFromArgs(this.clientVersion, sessionName, args));
      this.sessions.set(sessionName, session);
    }

    for (const globalOption of ['browser', 'config', 'extension', 'headed', 'help', 'isolated', 'session', 'version'])
      delete args[globalOption];
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

  async restart(sessionName?: string): Promise<void> {
    sessionName = this._resolveSessionName(sessionName);
    const session = this.sessions.get(sessionName);
    if (!session) {
      console.log(`Session '${sessionName}' does not exist.`);
      return;
    }
    await session.restart(session.config());
    session.close();
  }

  async configure(args: any): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    let session = this.sessions.get(sessionName);
    const sessionConfig = sessionConfigFromArgs(this.clientVersion, sessionName, args);
    if (!session) {
      session = new Session(this.clientVersion, sessionName, sessionConfig);
      this.sessions.set(sessionName, session);
    }
    await session.restart(sessionConfig);
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
      const liveMarker = await session.canConnect() ? `[running] ` : '[stopped] ';
      const restartMarker = !session.isCompatible() ? ` - v${session.config().version}, needs restart` : '';
      console.log(`  ${liveMarker}${session.name}${restartMarker}`);
    }
    if (sessions.size === 0)
      console.log('  (no sessions)');
    return;
  }

  if (subcommand === 'restart') {
    await sessionManager.restart(args._[1]);
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
  const version = process.env.PLAYWRIGHT_CLI_VERSION_FOR_TEST || options.version;
  const argv = process.argv.slice(2);
  const args: MinimistArgs = require('minimist')(argv, { boolean: booleanOptions });
  for (const option of booleanOptions) {
    if (!argv.includes(`--${option}`) && !argv.includes(`--no-${option}`))
      delete args[option];
  }

  const help = require('./help.json');
  const commandName = args._[0];

  if (args.version || args.v) {
    console.log(version);
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

  const sessionManager = await SessionManager.create(version, args);
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

function daemonSocketPath(sessionName: string): string {
  const socketName = `${sessionName}.sock`;
  if (os.platform() === 'win32')
    return `\\\\.\\pipe\\${installationDirHash}-${socketName}`;
  const socketsDir = process.env.PLAYWRIGHT_DAEMON_SOCKETS_DIR || path.join(os.tmpdir(), 'playwright-cli');
  return path.join(socketsDir, installationDirHash, socketName);
}

function sessionConfigFromArgs(version: string, sessionName: string, args: MinimistArgs): SessionConfig {
  let config = args.config;
  try {
    if (!config && fs.existsSync('playwright-cli.json'))
      config = path.resolve('playwright-cli.json');
  } catch {
  }
  return {
    version,
    socketPath: daemonSocketPath(sessionName),
    cli: {
      headed: args.headed,
      extension: args.extension,
      browser: args.browser,
      isolated: args.isolated,
      config,
    },
    userDataDirPrefix: path.resolve(daemonProfilesDir, `ud-${sessionName}`),
  };
}
