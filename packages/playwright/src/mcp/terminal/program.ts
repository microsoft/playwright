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

import type { Section } from '../browser/response';

export type StructuredResponse = {
  isError?: boolean;
  text?: string;
  sections: Section[];
};

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

  async run(args: any) {
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

type SessionManagerOptions = { config?: string, headed?: boolean };

class SessionManager {
  private _options: SessionManagerOptions;

  constructor(options: SessionManagerOptions) {
    this._options = options;
  }

  async list(): Promise<{ name: string, live: boolean }[]> {
    const dir = daemonProfilesDir;
    try {
      const files = await fs.promises.readdir(dir);
      const sessions: { name: string, live: boolean }[] = [];
      for (const file of files) {
        if (file.startsWith('ud-')) {
          // Session is like ud-<sessionName>-browserName
          const sessionName = file.split('-')[1];
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
    await printResponse(result);
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
    const dataDirs = await fs.promises.readdir(daemonProfilesDir).catch(() => []);
    const matchingDirs = dataDirs.filter(dir => dir.startsWith(`ud-${sessionName}-`));
    if (matchingDirs.length === 0) {
      console.log(`No user data found for session '${sessionName}'.`);
      return;
    }
    for (const dir of matchingDirs) {
      const userDataDir = path.resolve(daemonProfilesDir, dir);
      for (let i = 0; i < 5; i++) {
        try {
          await fs.promises.rm(userDataDir, { recursive: true });
          console.log(`Deleted user data for session '${sessionName}'.`);
          break;
        } catch (e: any) {
          if (e.code === 'ENOENT') {
            console.log(`No user data found for session '${sessionName}'.`);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (i === 4)
            throw e;
        }
      }
    }

    // Also try to delete the socket file if it exists
    if (os.platform() !== 'win32') {
      const socketPath = this._daemonSocketPath(sessionName);
      await fs.promises.unlink(socketPath).catch(() => {});
    }
  }

  private async _connect(sessionName: string): Promise<Session> {
    const socketPath = this._daemonSocketPath(sessionName);
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

    await fs.promises.mkdir(daemonProfilesDir, { recursive: true });
    const userDataDir = path.resolve(daemonProfilesDir, `ud-${sessionName}`);
    const cliPath = path.join(__dirname, '../../../cli.js');
    debugCli(`Will launch daemon process: ${cliPath}`);
    const configFile = resolveConfigFile(this._options.config);
    const configArg = configFile !== undefined ? [`--config=${configFile}`] : [];
    const headedArg = this._options.headed ? [`--daemon-headed`] : [];

    const outLog = path.join(daemonProfilesDir, 'out.log');
    const errLog = path.join(daemonProfilesDir, 'err.log');
    const out = fs.openSync(outLog, 'w');
    const err = fs.openSync(errLog, 'w');

    const child = spawn(process.execPath, [
      cliPath,
      'run-mcp-server',
      `--daemon=${socketPath}`,
      `--daemon-data-dir=${userDataDir}`,
      ...configArg,
      ...headedArg,
    ], {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(), // Will be used as root.
    });
    child.unref();

    console.log(`<!-- Daemon for \`${sessionName}\` session started with pid ${child.pid}.`);
    if (configFile)
      console.log(`- Using config file at \`${configFile}\`.`);
    const sessionSuffix = sessionName !== 'default' ? ` "${sessionName}"` : '';
    console.log(`- You can stop the session daemon with \`playwright-cli session-stop${sessionSuffix}\` when done.`);
    console.log(`- You can delete the session data with \`playwright-cli session-delete${sessionSuffix}\` when done.`);
    console.log('-->');

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

    const outData = await fs.promises.readFile(outLog, 'utf-8').catch(() => '');
    const errData = await fs.promises.readFile(errLog, 'utf-8').catch(() => '');

    console.error(`Failed to connect to daemon at ${socketPath} after ${maxRetries * retryDelay}ms`);
    if (outData.length)
      console.log(outData);
    if (errData.length)
      console.error(errData);
    process.exit(1);
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
      return `\\\\.\\pipe\\${installationDirHash}-${socketName}`;
    const socketsDir = process.env.PLAYWRIGHT_DAEMON_SOCKETS_DIR || path.join(os.tmpdir(), 'playwright-cli');
    return path.join(socketsDir, installationDirHash, socketName);
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

export async function program(options: { version: string }) {
  const argv = process.argv.slice(2);
  const args = require('minimist')(argv, {
    boolean: ['help', 'version', 'headed'],
  });
  if (!argv.includes('--headed') && !argv.includes('--no-headed'))
    delete args.headed;

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

  const sessionManager = new SessionManager(args);
  if (commandName.startsWith('session')) {
    await handleSessionCommand(sessionManager, args);
    return;
  }

  await sessionManager.run(args);
}

export async function printResponse(response: StructuredResponse) {
  const { sections } = response;
  if (!sections) {
    console.log('### Error\n' + response.text);
    return;
  }

  const text: string[] = [];
  for (const section of sections) {
    text.push(`### ${section.title}`);
    for (const result of section.content) {
      if (!result.file) {
        if (result.text !== undefined)
          text.push(result.text);
        continue;
      }

      const generatedFileName = await outputFile(dateAsFileName(result.file.prefix, result.file.ext), { origin: 'code' });
      const fileName = result.file.suggestedFilename ? await outputFile(result.file.suggestedFilename, { origin: 'llm' }) : generatedFileName;
      text.push(`- [${result.title}](${path.relative(process.cwd(), fileName)})`);
      if (result.data)
        await fs.promises.writeFile(fileName, result.data);
      else if (result.isBase64)
        await fs.promises.writeFile(fileName, Buffer.from(result.text!, 'base64'));
      else
        await fs.promises.writeFile(fileName, result.text!);
    }
  }
  console.log(text.join('\n'));
}

function dateAsFileName(prefix: string, extension: string): string {
  const date = new Date();
  return `${prefix}-${date.toISOString().replace(/[:.]/g, '-')}.${extension}`;
}

const outputDir = path.join(process.cwd(), '.playwright-cli');

async function outputFile(fileName: string, options: { origin: 'code' | 'llm' | 'web' }): Promise<string> {
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Trust code.
  if (options.origin === 'code')
    return path.resolve(outputDir, fileName);

  // Trust llm to use valid characters in file names.
  if (options.origin === 'llm') {
    fileName = fileName.split('\\').join('/');
    const resolvedFile = path.resolve(outputDir, fileName);
    if (!resolvedFile.startsWith(path.resolve(outputDir) + path.sep))
      throw new Error(`Resolved file path ${resolvedFile} is outside of the output directory ${outputDir}. Use relative file names to stay within the output directory.`);
    return resolvedFile;
  }

  // Do not trust web, at all.
  return path.join(outputDir, sanitizeForFilePath(fileName));
}

function sanitizeForFilePath(s: string) {
  const sanitize = (s: string) => s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
  const separator = s.lastIndexOf('.');
  if (separator === -1)
    return sanitize(s);
  return sanitize(s.substring(0, separator)) + '.' + sanitize(s.substring(separator + 1));
}

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
