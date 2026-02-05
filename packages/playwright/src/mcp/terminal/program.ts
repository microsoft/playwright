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

import { execSync, spawn } from 'child_process';

import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { SocketConnection } from './socketConnection';

import type { Config } from '../config';

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
    persistent?: boolean;
    profile?: string;
    config?: string;
  };
  userDataDirPrefix?: string;
  workspaceDir?: string;
};

type ClientInfo = {
  version: string;
  workspaceDirHash: string;
  daemonProfilesDir: string;
  workspaceDir: string | undefined;
};

class Session {
  readonly name: string;
  private _connection: SocketConnection | undefined;
  private _nextMessageId = 1;
  private _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, method: string, params: any }>();
  private _config: SessionConfig;
  private _clientInfo: ClientInfo;

  constructor(clientInfo: ClientInfo, name: string, options: SessionConfig) {
    this.name = name;
    this._clientInfo = clientInfo;
    this._config = options;
  }

  config(): SessionConfig {
    return this._config;
  }

  isCompatible(): boolean {
    return this._clientInfo.version === this._config.version;
  }

  checkCompatible() {
    if (!this.isCompatible()) {
      throw new Error(`Client is v${this._clientInfo.version}, session '${this.name}' is v${this._config.version}. Run

  playwright-cli session-restart${this.name !== 'default' ? ` ${this.name}` : ''}

to restart the session daemon.`);
    }
  }

  async run(args: MinimistArgs): Promise<{ text: string }> {
    this.checkCompatible();
    return await this._send('run', { args, cwd: process.cwd() });
  }

  async stop(): Promise<void> {
    if (!await this.canConnect()) {
      console.log(`Session '${this.name}' is not running.`);
      return;
    }

    await this._stopDaemon();
    console.log(`Session '${this.name}' stopped.`);
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
      console.log(`No user data found for session '${this.name}'.`);
      return;
    }

    for (const entry of matchingEntries) {
      const userDataDir = path.resolve(this._clientInfo.daemonProfilesDir, entry);
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

  private _sessionConfigFile() {
    return path.resolve(this._clientInfo.daemonProfilesDir, `${this.name}.session`);
  }

  private async _startDaemon(): Promise<net.Socket> {
    await fs.promises.mkdir(this._clientInfo.daemonProfilesDir, { recursive: true });
    const cliPath = path.join(__dirname, '../../../cli.js');

    const sessionConfigFile = this._sessionConfigFile();
    this._config.version = this._clientInfo.version;
    await fs.promises.writeFile(sessionConfigFile, JSON.stringify(this._config, null, 2));

    const outLog = path.join(this._clientInfo.daemonProfilesDir, 'out.log');
    const errLog = path.join(this._clientInfo.daemonProfilesDir, 'err.log');
    const out = fs.openSync(outLog, 'w');
    const err = fs.openSync(errLog, 'w');

    const args = [
      cliPath,
      'run-mcp-server',
      `--daemon-session=${sessionConfigFile}`,
    ];

    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(), // Will be used as root.
    });
    child.unref();

    console.log(`### Session \`${this.name}\` started with pid ${child.pid}.`);
    const configArgs = configToFormattedArgs(this._config.cli);
    if (configArgs.length) {
      console.log(`- Session options:`);
      for (const flag of configArgs)
        console.log(`  ${flag}`);
    }
    const sessionOption = this.name !== 'default' ? ` --session="${this.name}"` : '';
    console.log(formatWithGap(`- playwright-cli${sessionOption} close`, `# to stop when done.`));
    console.log(formatWithGap(`- playwright-cli${sessionOption} open [options]`, `# to reopen with new config.`));
    console.log(formatWithGap(`- playwright-cli${sessionOption} delete-data`, `# to delete session data.`));
    console.log(`---`);
    console.log(``);

    // Wait for the socket to become available with retries.
    const retryDelay = [100, 200, 400]; // ms
    let totalWaited = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, retryDelay[i] || 1000));
      totalWaited += retryDelay[i] || 1000;
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

    console.error(`Failed to connect to daemon at ${this._config.socketPath} after ${totalWaited}ms`);
    if (outData.length)
      console.log(outData);
    if (errData.length)
      console.error(errData);
    process.exit(1);
  }

  private async _stopDaemon(): Promise<void> {
    let error: Error | undefined;
    await this._send('stop').catch(e => { error = e; });
    this.disconnect();
    await this.deleteSession();
    if (error && !error?.message?.includes('Session closed'))
      throw error;
  }

  async deleteSession() {
    if (os.platform() !== 'win32')
      await fs.promises.unlink(this._config.socketPath).catch(() => {});
    await fs.promises.rm(this._sessionConfigFile()).catch(() => {});
  }
}

class SessionManager {
  readonly clientInfo: ClientInfo;
  readonly sessions: Map<string, Session>;

  private constructor(clientInfo: ClientInfo, sessions: Map<string, Session>) {
    this.clientInfo = clientInfo;
    this.sessions = sessions;
  }

  static async create(clientInfo: ClientInfo): Promise<SessionManager> {
    const dir = clientInfo.daemonProfilesDir;
    const sessions = new Map<string, Session>();
    const files = await fs.promises.readdir(dir).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.session'))
        continue;
      try {
        const sessionName = path.basename(file, '.session');
        const sessionConfig = await fs.promises.readFile(path.join(dir, file), 'utf-8').then(data => JSON.parse(data)) as SessionConfig;
        sessions.set(sessionName, new Session(clientInfo, sessionName, sessionConfig));
      } catch {
      }
    }
    return new SessionManager(clientInfo, sessions);
  }

  async open(args: MinimistArgs): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    let session = this.sessions.get(sessionName);
    if (session)
      await session.stop();

    session = new Session(this.clientInfo, sessionName, sessionConfigFromArgs(this.clientInfo, sessionName, args));
    this.sessions.set(sessionName, session);
    await this.run(args);
  }

  async run(args: MinimistArgs): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    const session = this.sessions.get(sessionName);
    if (!session) {
      console.log(`The session '${sessionName}' is not open, please run open first`);
      console.log('');
      console.log(`  playwright-cli${sessionName !== 'default' ? ` --session=${sessionName}` : ''} open [params]`);
      process.exit(1);
    }

    for (const globalOption of globalOptions)
      delete args[globalOption];
    const result = await session.run(args);
    console.log(result.text);
    session.disconnect();
  }

  async close(options: GlobalOptions): Promise<void> {
    const sessionName = this._resolveSessionName(options.session);
    const session = this.sessions.get(sessionName);
    if (!session || !await session.canConnect()) {
      console.log(`Session '${sessionName}' is not running.`);
      return;
    }

    await session.stop();
  }

  async deleteData(options: GlobalOptions): Promise<void> {
    const sessionName = this._resolveSessionName(options.session);
    const session = this.sessions.get(sessionName);
    if (!session) {
      console.log(`No user data found for session '${sessionName}'.`);
      return;
    }
    await session.deleteData();
    this.sessions.delete(sessionName);
  }

  private _resolveSessionName(sessionName?: string): string {
    if (sessionName)
      return sessionName;
    if (process.env.PLAYWRIGHT_CLI_SESSION)
      return process.env.PLAYWRIGHT_CLI_SESSION;
    return 'default';
  }
}

function createClientInfo(packageLocation: string): ClientInfo {
  const packageJSON = require(packageLocation);
  const workspaceDir = findWorkspaceDir(process.cwd());
  const version = process.env.PLAYWRIGHT_CLI_VERSION_FOR_TEST || packageJSON.version;

  const hash = crypto.createHash('sha1');
  hash.update(workspaceDir || packageLocation);
  const workspaceDirHash = hash.digest('hex').substring(0, 16);

  return {
    version,
    workspaceDir,
    workspaceDirHash,
    daemonProfilesDir: daemonProfilesDir(workspaceDirHash),
  };
}

function findWorkspaceDir(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.playwright')))
      return dir;
    const parentDir = path.dirname(dir);
    if (parentDir === dir)
      break;
    dir = parentDir;
  }
  return undefined;
}

const baseDaemonDir = (() => {
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
  return path.join(localCacheDir, 'ms-playwright', 'daemon');
})();

const daemonProfilesDir = (workspaceDirHash: string) => {
  return path.join(baseDaemonDir, workspaceDirHash);
};

type GlobalOptions = {
  help?: boolean;
  session?: string;
  version?: boolean;
};

type OpenOptions = {
  browser?: string;
  config?: string;
  extension?: boolean;
  headed?: boolean;
  persistent?: boolean;
  profile?: string;
};

const globalOptions: (keyof (GlobalOptions & OpenOptions))[] = [
  'browser',
  'config',
  'extension',
  'headed',
  'help',
  'persistent',
  'profile',
  'session',
  'version',
];

const booleanOptions: (keyof (GlobalOptions & OpenOptions & { all?: boolean }))[] = [
  'all',
  'help',
  'version',
  'extension',
  'headed',
  'persistent'
];

export async function program(packageLocation: string) {
  const clientInfo = createClientInfo(packageLocation);

  const argv = process.argv.slice(2);
  const args: MinimistArgs = require('minimist')(argv, { boolean: booleanOptions });
  for (const option of booleanOptions) {
    if (!argv.includes(`--${option}`) && !argv.includes(`--no-${option}`))
      delete args[option];
  }

  const help = require('./help.json');
  const commandName = args._?.[0];

  if (args.version || args.v) {
    console.log(clientInfo.version);
    process.exit(0);
  }

  const command = commandName && help.commands[commandName];
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

  const sessionManager = await SessionManager.create(clientInfo);

  switch (commandName) {
    case 'session-list': {
      if (args.all)
        await listAllSessions(clientInfo);
      else
        await listSessions(sessionManager);
      return;
    }
    case 'session-close-all': {
      const sessions = sessionManager.sessions;
      for (const session of sessions.values())
        await session.stop();
      return;
    }
    case 'delete-data':
      await sessionManager.deleteData(args as GlobalOptions);
      return;
    case 'session-kill-all':
      await killAllDaemons();
      return;
    case 'open':
      await sessionManager.open(args);
      return;
    case 'close':
      await sessionManager.close(args as GlobalOptions);
      return;
    case 'install':
      await install(args);
      return;
    default:
      await sessionManager.run(args);
  }
}

async function install(args: MinimistArgs) {
  const cwd = process.cwd();

  // Create .playwright folder to mark workspace root
  const playwrightDir = path.join(cwd, '.playwright');
  await fs.promises.mkdir(playwrightDir, { recursive: true });
  console.log(`Workspace initialized at ${cwd}`);

  if (args.skills) {
    const skillSourceDir = path.join(__dirname, '../../skill');
    const skillDestDir = path.join(cwd, '.claude', 'skills', 'playwright-cli');

    if (!fs.existsSync(skillSourceDir)) {
      console.error('Skills source directory not found:', skillSourceDir);
      process.exit(1);
    }

    await fs.promises.cp(skillSourceDir, skillDestDir, { recursive: true });
    console.log(`Skills installed to ${path.relative(cwd, skillDestDir)}`);
  }

  if (!args.config && !fs.existsSync(defaultConfigFile())) {
    const channel = await checkAndInstallBrowser();
    if (channel !== 'chrome')
      await createDefaultConfig(channel);
  }
}

async function createDefaultConfig(channel: string) {
  const config: Config = {
    browser: {
      browserName: 'chromium',
      launchOptions: {
        channel,
      },
    },
  };
  await fs.promises.writeFile(defaultConfigFile(), JSON.stringify(config, null, 2));
  console.log(`Created default config for ${channel}.`);
}

async function checkAndInstallBrowser() {
  const { registry } = await import('playwright-core/lib/server/registry/index');
  const channels = ['chrome', 'chrome-beta', 'chrome-dev', 'chrome-canary', 'msedge', 'msedge-beta', 'msedge-dev', 'msedge-canary'];
  for (const channel of channels) {
    const executable = registry.findExecutable(channel);
    if (!executable?.executablePath())
      continue;
    console.log(`Found ${channel} browser. ${executable.executablePath()}`);
    return channel;
  }
  const chromiumExecutable = registry.findExecutable('chromium');
  // Unlike channels, chromium executable path is always valid even if the browser is not installed.
  if (fs.existsSync(chromiumExecutable?.executablePath()!))
    return 'chromium';
  console.log('No Chrome or Edge browser installation found. Installing Chromium...');
  await registry.install([chromiumExecutable]);
  console.log('Chromium browser installed successfully.');
  return 'chromium';
}

function daemonSocketPath(clientInfo: ClientInfo, sessionName: string): string {
  const socketName = `${sessionName}.sock`;
  if (os.platform() === 'win32')
    return `\\\\.\\pipe\\${clientInfo.workspaceDirHash}-${socketName}`;
  const socketsDir = process.env.PLAYWRIGHT_DAEMON_SOCKETS_DIR || path.join(os.tmpdir(), 'playwright-cli');
  return path.join(socketsDir, clientInfo.workspaceDirHash, socketName);
}

function defaultConfigFile(): string {
  return path.resolve('.playwright', 'cli.config.json');
}

function sessionConfigFromArgs(clientInfo: ClientInfo, sessionName: string, args: MinimistArgs): SessionConfig {
  let config = args.config ? path.resolve(args.config) : undefined;
  try {
    if (!config && fs.existsSync(defaultConfigFile()))
      config = defaultConfigFile();
  } catch {
  }

  if (!args.persistent && args.profile)
    args.persistent = true;

  return {
    version: clientInfo.version,
    socketPath: daemonSocketPath(clientInfo, sessionName),
    cli: {
      headed: args.headed,
      extension: args.extension,
      browser: args.browser,
      persistent: args.persistent,
      profile: args.profile,
      config,
    },
    userDataDirPrefix: path.resolve(clientInfo.daemonProfilesDir, `ud-${sessionName}`),
    workspaceDir: clientInfo.workspaceDir,
  };
}

function configToFormattedArgs(cli: SessionConfig['cli']): string[] {
  const args: string[] = [];
  const add = (flag: string, value: string | boolean | undefined) => {
    if (typeof value === 'boolean' && value)
      args.push(`--${flag}`);
    else if (typeof value === 'string')
      args.push(`--${flag}=${value}`);
  };
  add('browser', cli.browser);
  add('config', cli.config ? path.relative(process.cwd(), cli.config) : undefined);
  add('extension', cli.extension);
  add('headed', cli.headed);
  add('persistent', cli.persistent);
  add('profile', cli.profile);
  return args;
}

async function killAllDaemons(): Promise<void> {
  const platform = os.platform();
  let killed = 0;

  try {
    if (platform === 'win32') {
      const result = execSync(
          `powershell -NoProfile -NonInteractive -Command `
          + `"Get-CimInstance Win32_Process `
          + `| Where-Object { $_.CommandLine -like '*run-mcp-server*' -and $_.CommandLine -like '*--daemon-session*' } `
          + `| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }"`,
          { encoding: 'utf-8' }
      );
      const pids = result.split('\n')
          .map(line => line.trim())
          .filter(line => /^\d+$/.test(line));
      for (const pid of pids)
        console.log(`Killed daemon process ${pid}`);
      killed = pids.length;
    } else {
      const result = execSync('ps aux', { encoding: 'utf-8' });
      const lines = result.split('\n');
      for (const line of lines) {
        if (line.includes('run-mcp-server') && line.includes('--daemon-session')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && /^\d+$/.test(pid)) {
            try {
              process.kill(parseInt(pid, 10), 'SIGKILL');
              console.log(`Killed daemon process ${pid}`);
              killed++;
            } catch {
              // Process may have already exited
            }
          }
        }
      }
    }
  } catch (e) {
    // Silently handle errors - no processes to kill is fine
  }

  if (killed === 0)
    console.log('No daemon processes found.');
  else if (killed > 0)
    console.log(`Killed ${killed} daemon process${killed === 1 ? '' : 'es'}.`);
}

async function listSessions(sessionManager: SessionManager): Promise<void> {
  const sessions = sessionManager.sessions;
  console.log('Sessions:');
  for (const session of sessions.values()) {
    const canConnect = await session.canConnect();
    if (!canConnect) {
      console.log(`  ${session.name} is stale, removing`);
      await session.deleteSession();
    } else {
      const restartMarker = !session.isCompatible() ? ` - v${session.config().version}, please reopen` : '';
      console.log(`  ${session.name}${restartMarker}`);
      const config = session.config();
      configToFormattedArgs(config.cli).forEach(arg => console.log(`     ${arg}`));
    }
  }
  if (sessions.size === 0)
    console.log('  (no sessions)');
}

async function listAllSessions(clientInfo: ClientInfo): Promise<void> {
  const hashes = await fs.promises.readdir(baseDaemonDir).catch(() => []);

  // Group sessions by workspace folder
  const sessionsByWorkspace = new Map<string, { name: string, config: SessionConfig, canConnect: boolean, isCompatible: boolean }[]>();

  for (const hash of hashes) {
    const hashDir = path.join(baseDaemonDir, hash);
    const stat = await fs.promises.stat(hashDir).catch(() => null);
    if (!stat?.isDirectory())
      continue;

    const files = await fs.promises.readdir(hashDir).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.session'))
        continue;
      try {
        const sessionName = path.basename(file, '.session');
        const sessionConfig = await fs.promises.readFile(path.join(hashDir, file), 'utf-8').then(data => JSON.parse(data)) as SessionConfig;
        const session = new Session(clientInfo, sessionName, sessionConfig);
        const canConnect = await session.canConnect();
        const isCompatible = session.isCompatible();

        // Use workspace folder from config, or empty string if not set (installation folder case)
        const workspaceKey = sessionConfig.workspaceDir || '';
        if (!sessionsByWorkspace.has(workspaceKey))
          sessionsByWorkspace.set(workspaceKey, []);
        sessionsByWorkspace.get(workspaceKey)!.push({ name: sessionName, config: sessionConfig, canConnect, isCompatible });
      } catch {
      }
    }
  }

  if (sessionsByWorkspace.size === 0) {
    console.log('No sessions found.');
    return;
  }

  // Sort workspace keys: empty string (no workspace) last, others alphabetically
  const sortedWorkspaces = [...sessionsByWorkspace.keys()].sort((a, b) => {
    if (a === '' && b !== '')
      return 1;
    if (a !== '' && b === '')
      return -1;
    return a.localeCompare(b);
  });

  for (const workspace of sortedWorkspaces) {
    const sessions = sessionsByWorkspace.get(workspace)!;
    // Only print workspace folder if it's set
    if (workspace)
      console.log(`${workspace}:`);
    for (const { name, config, canConnect, isCompatible } of sessions) {
      if (!canConnect) {
        console.log(`  ${name} (stale)`);
      } else {
        const restartMarker = !isCompatible ? ` - v${config.version}, please reopen` : '';
        console.log(`  ${name}${restartMarker}`);
        configToFormattedArgs(config.cli).forEach(arg => console.log(`     ${arg}`));
      }
    }
  }
}

function formatWithGap(prefix: string, text: string, threshold: number = 40) {
  const indent = Math.max(1, threshold - prefix.length);
  return prefix + ' '.repeat(indent) + text;
}
