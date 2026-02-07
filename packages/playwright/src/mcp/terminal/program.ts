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
import type { FullConfig } from '../browser/config';

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
  resolvedConfig?: FullConfig
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

  playwright-cli${this.name !== 'default' ? ` -s=${this.name}` : ''} open

to restart the browser session.`);
    }
  }

  async run(args: MinimistArgs): Promise<{ text: string }> {
    this.checkCompatible();
    return await this._send('run', { args, cwd: process.cwd() });
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

  private _sessionFile(suffix: string) {
    return path.resolve(this._clientInfo.daemonProfilesDir, `${this.name}${suffix}`);
  }

  private async _startDaemon(): Promise<net.Socket> {
    await fs.promises.mkdir(this._clientInfo.daemonProfilesDir, { recursive: true });
    const cliPath = path.join(__dirname, '../../../cli.js');

    const sessionConfigFile = this._sessionFile('.session');
    this._config.version = this._clientInfo.version;
    await fs.promises.writeFile(sessionConfigFile, JSON.stringify(this._config, null, 2));

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
        this._config.resolvedConfig = resolvedConfig;
        console.log(`- ${this.name}:`);
        console.log(renderResolvedConfig(resolvedConfig).join('\n'));
      }
      console.log(`---`);

      await fs.promises.writeFile(sessionConfigFile, JSON.stringify(this._config, null, 2));
      return socket;
    }

    console.error(`Failed to connect to daemon at ${this._config.socketPath}`);
    process.exit(1);
  }

  private async _stopDaemon(): Promise<void> {
    let error: Error | undefined;
    await this._send('stop').catch(e => { error = e; });
    if (os.platform() !== 'win32')
      await fs.promises.unlink(this._config.socketPath).catch(() => {});

    this.disconnect();
    if (!this._config.cli.persistent)
      await this.deleteSessionConfig();
    if (error && !error?.message?.includes('Session closed'))
      throw error;
  }

  async deleteSessionConfig() {
    await fs.promises.rm(this._sessionFile('.session')).catch(() => {});
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
      await session.stop(true);

    session = new Session(this.clientInfo, sessionName, sessionConfigFromArgs(this.clientInfo, sessionName, args));
    this.sessions.set(sessionName, session);
    await this.run(args);
  }

  async run(args: MinimistArgs): Promise<void> {
    const sessionName = this._resolveSessionName(args.session);
    const session = this.sessions.get(sessionName);
    if (!session) {
      console.log(`The browser '${sessionName}' is not open, please run open first`);
      console.log('');
      console.log(`  playwright-cli${sessionName !== 'default' ? ` -s=${sessionName}` : ''} open [params]`);
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
      console.log(`Browser '${sessionName}' is not open.`);
      return;
    }

    await session.stop();
  }

  async deleteData(options: GlobalOptions): Promise<void> {
    const sessionName = this._resolveSessionName(options.session);
    const session = this.sessions.get(sessionName);
    if (!session) {
      console.log(`No user data found for browser '${sessionName}'.`);
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
  const help = require('./help.json');

  const argv = process.argv.slice(2);
  const boolean = [...help.booleanOptions, ...booleanOptions];
  const args: MinimistArgs = require('minimist')(argv, { boolean });
  for (const [key, value] of Object.entries(args)) {
    if (key !== '_' && typeof value !== 'boolean')
      args[key] = String(value);
  }
  for (let index = 0; index < args._.length; index++)
    args._[index] = String(args._[index]);
  for (const option of boolean) {
    if (!argv.includes(`--${option}`) && !argv.includes(`--no-${option}`))
      delete args[option];
    if (argv.some(arg => arg.startsWith(`--${option}=`) || arg.startsWith(`--no-${option}=`))) {
      console.error(`boolean option '--${option}' should not be passed with '=value', use '--${option}' or '--no-${option}' instead`);
      process.exit(1);
    }
  }
  // Normalize -s alias to --session
  if (args.s) {
    args.session = args.s;
    delete args.s;
  }

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
    case 'list': {
      if (args.all)
        await listAllSessions(clientInfo);
      else
        await listSessions(sessionManager);
      return;
    }
    case 'close-all': {
      const sessions = sessionManager.sessions;
      for (const session of sessions.values())
        await session.stop(true);
      return;
    }
    case 'delete-data':
      await sessionManager.deleteData(args as GlobalOptions);
      return;
    case 'kill-all':
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
  console.log(`✅ Workspace initialized at \`${cwd}\`.`);

  if (args.skills) {
    const skillSourceDir = path.join(__dirname, '../../skill');
    const skillDestDir = path.join(cwd, '.claude', 'skills', 'playwright-cli');

    if (!fs.existsSync(skillSourceDir)) {
      console.error('❌ Skills source directory not found:', skillSourceDir);
      process.exit(1);
    }

    await fs.promises.cp(skillSourceDir, skillDestDir, { recursive: true });
    console.log(`✅ Skills installed to \`${path.relative(cwd, skillDestDir)}\`.`);
  }

  if (!args.config)
    await ensureConfiguredBrowserInstalled();
}

async function ensureConfiguredBrowserInstalled() {
  if (fs.existsSync(defaultConfigFile())) {
    const { registry } = await import('playwright-core/lib/server/registry/index');
    // Config exists, ensure configured browser is installed
    const config = JSON.parse(await fs.promises.readFile(defaultConfigFile(), 'utf-8')) as Config;
    const browserName = config.browser?.browserName ?? 'chromium';
    const channel = config.browser?.launchOptions?.channel;
    if (!channel || channel.startsWith('chromium')) {
      const executable = registry.findExecutable(channel ?? browserName);
      if (executable && !fs.existsSync(executable?.executablePath()!))
        await registry.install([executable]);
    }
  } else {
    // No config exists, detect or install a browser and create config
    const channel = await findOrInstallDefaultBrowser();
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
  console.log(`✅ Created default config for ${channel} at ${path.relative(process.cwd(), defaultConfigFile())}.`);
}

async function findOrInstallDefaultBrowser() {
  const { registry } = await import('playwright-core/lib/server/registry/index');
  const channels = ['chrome', 'msedge'];
  for (const channel of channels) {
    const executable = registry.findExecutable(channel);
    if (!executable?.executablePath())
      continue;
    console.log(`✅ Found ${channel}, will use it as the default browser.`);
    return channel;
  }
  const chromiumExecutable = registry.findExecutable('chromium');
  // Unlike channels, chromium executable path is always valid, even if the browser is not installed.
  if (!fs.existsSync(chromiumExecutable?.executablePath()!))
    await registry.install([chromiumExecutable]);
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
  console.log('### Browsers');
  await gcAndPrintSessions([...sessions.values()]);
}

async function listAllSessions(clientInfo: ClientInfo): Promise<void> {
  const hashes = await fs.promises.readdir(baseDaemonDir).catch(() => []);

  // Group sessions by workspace folder
  const sessionsByWorkspace = new Map<string, Session[]>();
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
        const workspaceKey = sessionConfig.workspaceDir || '<global>';
        if (!sessionsByWorkspace.has(workspaceKey))
          sessionsByWorkspace.set(workspaceKey, []);
        sessionsByWorkspace.get(workspaceKey)!.push(session);
      } catch {
      }
    }
  }

  if (sessionsByWorkspace.size === 0) {
    console.log('No browsers found.');
    return;
  }

  const sortedWorkspaces = [...sessionsByWorkspace.keys()].sort();

  for (const workspace of sortedWorkspaces) {
    const sessions = sessionsByWorkspace.get(workspace)!;
    console.log(`${workspace}:`);
    await gcAndPrintSessions(sessions);
  }
}

async function gcAndPrintSessions(sessions: Session[]) {
  const running: Session[] = [];
  const stopped: Session[] = [];

  for (const session of sessions.values()) {
    const canConnect = await session.canConnect();
    if (canConnect) {
      running.push(session);
    } else {
      if (session.config().cli.persistent)
        stopped.push(session);
      else
        await session.deleteSessionConfig();
    }
  }

  for (const session of running)
    console.log(await renderSessionStatus(session));
  for (const session of stopped)
    console.log(await renderSessionStatus(session));

  if (running.length === 0 && stopped.length === 0)
    console.log('  (no browsers)');

}

async function renderSessionStatus(session: Session) {
  const text: string[] = [];
  const config = session.config();
  const canConnect = await session.canConnect();
  text.push(`- ${session.name}:`);
  text.push(`  - status: ${canConnect ? 'open' : 'closed'}`);
  if (canConnect && !session.isCompatible())
    text.push(`  - version: v${config.version} [incompatible please re-open]`);
  if (config.resolvedConfig)
    text.push(...renderResolvedConfig(config.resolvedConfig));
  return text.join('\n');
}

function renderResolvedConfig(resolvedConfig: FullConfig) {
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
