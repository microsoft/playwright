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
/* eslint-disable no-restricted-properties */
/* eslint-disable no-console */
import net from 'net';
import { spawn } from 'child_process';

// Start a TCP server to bridge between parent (fd3/fd4) and the WSL child process.
// This is needed because wsl.exe only supports up to 3 forwarded fds, so we can’t
// pass extra pipes directly and must tunnel them over a socket instead.

(async () => {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error('Usage: node webkit-wsl-host-wrapper.mjs <executable> [args...]');
    process.exit(1);
  }

  const parentIn  = new net.Socket({ fd: 3, readable: true,  writable: false }); // parent -> us
  const parentOut = new net.Socket({ fd: 4, readable: false, writable: true  }); // us -> parent

  const server = net.createServer();

  const sockets = new Set<net.Socket>();
  server.on('connection', socket => {
    // Disable Nagle's algorithm to reduce latency for small, frequent messages.
    socket.setNoDelay(true);
    if (sockets.size > 0) {
      log('Extra connection received, destroying.');
      socket.destroy();
      return;
    }
    sockets.add(socket);
    log('Client connected, wiring pipes.');

    socket.pipe(parentOut);
    parentIn.pipe(socket);

    socket.on('close', () => {
      log('Socket closed');
      sockets.delete(socket);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => resolve(null));
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    console.error('Failed to obtain listening address');
    process.exit(1);
  }
  const port = address.port;
  log('Server listening on', port);

  // Spawn child process with augmented env. PW_WSL_BRIDGE_PORT is added to WSLENV
  // so this environment variable is propagated across Windows <-> WSL boundaries.
  // This does not forward the TCP port itself, only the env var containing it.
  const env = {
    ...process.env,
    // WSLENV is a colon-delimited list of environment variables that should be included when launching WSL processes from Win32 or Win32 processes from WSL
    WSLENV: 'PW_WSL_BRIDGE_PORT',
    PW_WSL_BRIDGE_PORT: String(port),
  };

  let shuttingDown = false;

  const child = spawn('wsl.exe', [
    '-d',
    'playwright',
    '--cd',
    '/home/pwuser',
    '/home/pwuser/node/bin/node',
    '/home/pwuser/webkit-wsl-transport-client.js',
    process.env.WEBKIT_EXECUTABLE || '',
    ...argv,
  ], {
    env,
    stdio: ['inherit', 'inherit', 'inherit'], // no fd3/fd4 here; they stay only in this wrapper
  });

  log('Spawned child pid', child.pid);

  child.on('close', (code, signal) => {
    log('Child exit', { code, signal });
    shutdown(code ?? (signal ? 0 : 0));
  });
  child.on('error', err => {
    console.error('Child process failed to start:', err);
    shutdown(1);
  });

  await new Promise(resolve => child.once('close', resolve));

  async function shutdown(code = 0) {
    if (shuttingDown)
      return;
    shuttingDown = true;

    parentIn.destroy();
    parentOut.destroy();

    // Close listener and destroy any sockets
    await new Promise(resolve => server.close(() => resolve(null)));
    for (const socket of sockets)
      socket.destroy();
  }

  function log(...args: any[]) {
    console.error(new Date(), '[webkit-wsl-host-wrapper]', ...args);
  }
})().catch(error => {
  console.error('Error occurred:', error);
  process.exit(1);
});
