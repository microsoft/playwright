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
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { program, debug } from 'playwright-core/lib/utilsBundle';
import { SocketConnection } from './socketConnection';

import type * as mcp from '../sdk/exports';

const debugCli = debug('pw:cli');

const packageJSON = require('../../../package.json');

program
    .version('Version ' + (process.env.PW_CLI_DISPLAY_VERSION || packageJSON.version))
    .name('playwright-command');

function addCommand(name: string, description: string, action: (...args: any[]) => Promise<void>) {
  program
      .command(name)
      .description(description)
      .action(action);
}

program
    .command('navigate <url>')
    .aliases(['open', 'goto'])
    .description('open url in the browser')
    .option('--headed', 'run browser in headed mode')
    .action(async (url, options) => {
      await runMcpCommand('browser_navigate', { url }, { headless: !options.headed });
    });

addCommand('close', 'close the browser', async () => {
  await runMcpCommand('browser_close', {});
});

// snapshot.ts
addCommand('click <ref>', 'click an element using a ref from a snapshot, e.g. e67', async ref => {
  await runMcpCommand('browser_click', { ref });
});

addCommand('snapshot', 'get accessible snapshot of the current page', async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await runMcpCommand('browser_snapshot', { filename: `snapshot-${timestamp}.md` });
});

addCommand('drag <startRef> <endRef>', 'drag from one element to another', async (startRef, endRef) => {
  await runMcpCommand('browser_drag', { startRef, endRef });
});

addCommand('hover <ref>', 'hover over an element', async ref => {
  await runMcpCommand('browser_hover', { ref });
});

addCommand('select <ref> <values...>', 'select option(s) in a dropdown', async (ref, values) => {
  await runMcpCommand('browser_select_option', { ref, values });
});

// TODO: remove?
addCommand('locator <ref>', 'generate a locator for an element', async ref => {
  await runMcpCommand('browser_generate_locator', { ref });
});

// keyboard.ts
addCommand('press <key>', 'press a key on the keyboard', async key => {
  await runMcpCommand('browser_press_key', { key });
});

addCommand('type <ref> <text>', 'type text into an element', async (ref, text) => {
  await runMcpCommand('browser_type', { ref, text });
});

// navigate.ts
addCommand('back', 'go back to the previous page', async () => {
  await runMcpCommand('browser_navigate_back', {});
});

// wait.ts
addCommand('wait <time>', 'wait for a specified time in seconds', async time => {
  await runMcpCommand('browser_wait_for', { time: parseFloat(time) });
});

addCommand('wait-for-text <text>', 'wait for text to appear', async text => {
  await runMcpCommand('browser_wait_for', { text });
});

// dialogs.ts
addCommand('dialog-accept [promptText]', 'accept a dialog', async promptText => {
  await runMcpCommand('browser_handle_dialog', { accept: true, promptText });
});

addCommand('dialog-dismiss', 'dismiss a dialog', async () => {
  await runMcpCommand('browser_handle_dialog', { accept: false });
});

// screenshot.ts
addCommand('screenshot [filename]', 'take a screenshot of the current page', async filename => {
  await runMcpCommand('browser_take_screenshot', { filename });
});

// common.ts (resize)
addCommand('resize <width> <height>', 'resize the browser window', async (width, height) => {
  await runMcpCommand('browser_resize', { width: parseInt(width, 10), height: parseInt(height, 10) });
});

// files.ts
addCommand('upload <paths...>', 'upload files', async paths => {
  await runMcpCommand('browser_file_upload', { paths });
});

// tabs.ts
addCommand('tabs', 'list all browser tabs', async () => {
  await runMcpCommand('browser_tabs', { action: 'list' });
});

addCommand('tab-new', 'create a new browser tab', async () => {
  await runMcpCommand('browser_tabs', { action: 'new' });
});

addCommand('tab-close [index]', 'close a browser tab', async index => {
  await runMcpCommand('browser_tabs', { action: 'close', index: index !== undefined ? parseInt(index, 10) : undefined });
});

addCommand('tab-select <index>', 'select a browser tab', async index => {
  await runMcpCommand('browser_tabs', { action: 'select', index: parseInt(index, 10) });
});


async function runMcpCommand(name: string, args: mcp.CallToolRequest['params']['arguments'], options: { headless?: boolean } = {}) {
  const session = await connectToDaemon(options);
  const result = await session.callTool(name, args);
  printResult(result);
  session.dispose();
}

function printResult(result: mcp.CallToolResult) {
  for (const content of result.content) {
    if (content.type === 'text')
      console.log(content.text);
    else
      console.log(`<${content.type} content>`);
  }
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

function daemonSocketPath(): string {
  const socketPath = path.resolve('.playwright.sock');
  return normalizeSocketPath(socketPath);
}

/**
 * Normalize socket path for the current platform.
 * On Windows, converts Unix-style paths to named pipe format.
 * On Unix, returns the path as-is.
 */
function normalizeSocketPath(path: string): string {
  if (os.platform() === 'win32') {
    // Windows named pipes use \\.\pipe\name format
    if (path.startsWith('\\\\.\\pipe\\'))
      return path;
    // Convert Unix-style path to Windows named pipe
    const name = path.replace(/[^a-zA-Z0-9]/g, '-');
    return `\\\\.\\pipe\\${name}`;
  }
  return path;
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

void program.parseAsync(process.argv);
