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
import { SocketConnection } from './socketConnection';

import type { ServerBackendFactory } from '../sdk/server';

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
  serverBackendFactory: ServerBackendFactory
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
    const connection = new SocketConnection(socket);
    connection.onclose = () => {
      daemonDebug('client disconnected');
    };
    connection.onmessage = async message => {
      const { id, method, params } = message;
      try {
        daemonDebug('received command', method);
        const response = await backend.callTool(method, params, () => {});
        daemonDebug('sending response', !!response);
        if (response)
          await connection.send({ id, result: response });
      } catch (e) {
        daemonDebug('command failed', e);
        await connection.send({ id, error: (e as Error).message });
        daemonDebug('error handling message', e);
      }
    };
  });

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
