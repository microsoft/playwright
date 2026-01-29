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

import fs from 'fs/promises';
import net from 'net';
import os from 'os';
import path from 'path';
import url from 'url';

import { debug } from 'playwright-core/lib/utilsBundle';
import { gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';

import { SocketConnection } from './socketConnection';
import { commands } from './commands';
import { parseCommand } from './command';

import type { ServerBackendFactory } from '../sdk/server';
import type * as mcp from '../sdk/exports';

const daemonDebug = debug('pw:daemon');

async function socketExists(socketPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(socketPath);
    if (stat?.isSocket())
      return true;
  } catch (e) {
  }
  return false;
}

/**
 * Start a daemon server listening on Unix domain socket (Unix) or named pipe (Windows).
 */
export async function startMcpDaemonServer(
  socketPath: string,
  serverBackendFactory: ServerBackendFactory,
  daemonVersion: string
): Promise<string> {
  // Clean up existing socket file on Unix
  if (os.platform() !== 'win32' && await socketExists(socketPath)) {
    daemonDebug(`Socket already exists, removing: ${socketPath}`);
    try {
      await fs.unlink(socketPath);
    } catch (error) {
      daemonDebug(`Failed to remove existing socket: ${error}`);
      throw error;
    }
  }

  const backend = serverBackendFactory.create();
  const cwd = url.pathToFileURL(process.cwd()).href;
  await backend.initialize?.({
    name: 'playwright-cli',
    version: '1.0.0',
    roots: [{
      uri: cwd,
      name: 'cwd'
    }],
    timestamp: Date.now(),
  });

  await fs.mkdir(path.dirname(socketPath), { recursive: true });

  const server = net.createServer(socket => {
    daemonDebug('new client connection');
    const connection = new SocketConnection(socket, daemonVersion);
    connection.onclose = () => {
      daemonDebug('client disconnected');
    };
    connection.onversionerror = (id, e) => {
      if (daemonVersion === 'undefined-for-test')
        return false;

      if (semverGreater(daemonVersion, e.received)) {
        // eslint-disable-next-line no-console
        connection.send({ id, error: `Client is too old: daemon is ${daemonVersion}, client is ${e.received}.` }).catch(e => console.error(e));
      } else {
        gracefullyProcessExitDoNotHang(0, async () => {
          // eslint-disable-next-line no-console
          await connection.send({ id, error: `Daemon is too old: daemon is ${daemonVersion}, client is ${e.received}. Stopping it.` }).catch(e => console.error(e));
          server.close();
        });
      }
      return true;
    };
    connection.onmessage = async message => {
      const { id, method, params } = message;
      try {
        daemonDebug('received command', method);
        if (method === 'stop') {
          daemonDebug('stop command received, shutting down');
          gracefullyProcessExitDoNotHang(0, async () => {
            await connection.send({ id, result: 'ok' }).catch(() => {});
            server.close();
          });
        } else if (method === 'run') {
          const { toolName, toolParams } = parseCliCommand(params.args);
          if (params.cwd)
            toolParams._meta = { cwd: params.cwd };
          const response = await backend.callTool(toolName, toolParams, () => {});
          await connection.send({ id, result: formatResult(response) });
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (e) {
        daemonDebug('command failed', e);
        await connection.send({ id, error: (e as Error).message });
      }
    };
  });

  backend.onBrowserContextClosed = () => {
    daemonDebug('browser closed, shutting down daemon');
    server.close();
    gracefullyProcessExitDoNotHang(0);
  };

  return new Promise((resolve, reject) => {
    server.on('error', (error: NodeJS.ErrnoException) => {
      daemonDebug(`server error: ${error.message}`);
      reject(error);
    });

    server.listen(socketPath, () => {
      daemonDebug(`daemon server listening on ${socketPath}`);
      resolve(socketPath);
    });
  });
}

function formatResult(result: mcp.CallToolResult) {
  const isError = result.isError;
  const text = result.content[0].type === 'text' ? result.content[0].text : undefined;
  return { isError, text };
}

function parseCliCommand(args: Record<string, string> & { _: string[] }): { toolName: string, toolParams: NonNullable<mcp.CallToolRequest['params']['arguments']> } {
  const command = commands[args._[0]];
  if (!command)
    throw new Error('Command is required');
  return parseCommand(command, args);
}

function semverGreater(a: string, b: string): boolean {
  a = a.replace(/-next$/, '');
  b = b.replace(/-next$/, '');
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    if (aParts[i] > bParts[i])
      return true;
    if (aParts[i] < bParts[i])
      return false;
  }
  return false;
}
