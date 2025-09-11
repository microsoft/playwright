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
import path from 'path';
import { spawn } from 'child_process';

// WebKit WSL Transport Architecture Diagram:
//
// ┌─────────────────┐    fd3/fd4     ┌──────────────────────┐
// │ Playwright      │◄──────────────►│ webkit-wsl-transport │
// │                 │   (pipes)      │ server.ts            │
// └─────────────────┘                │ (Windows/Host)       │
//                                    └──────────┬───────────┘
//                                               │ spawns
//                                               ▼
//                                    ┌──────────────────────┐
//                                    │ wsl.exe              │
//                                    │ -d playwright        │
//                                    └──────────┬───────────┘
//                                               │ starts
//                                               ▼
// ┌─────────────────┐    TCP socket   ┌──────────────────────┐    fd3/fd4     ┌─────────────┐
// │ TCP Server      │◄───────────────►│ webkit-wsl-transport │◄──────────────►│ WebKit      │
// │ (port forwarded │   over WSL      │ client.ts            │   (pipes)      │ Browser     │
// │ via env var)    │   boundary      │ (WSL/Linux)          │                │ Process     │
// └─────────────────┘                 └──────────────────────┘                └─────────────┘
//
// The TCP server bridges fd3/fd4 pipes across the WSL boundary because wsl.exe
// only supports forwarding up to 3 file descriptors (stdin/stdout/stderr).
//
// Data flow: Playwright ↔ fd3/fd4 ↔ TCP socket ↔ WSL network ↔ TCP socket ↔ fd3/fd4 ↔ WebKit
//
// Start a TCP server to bridge between parent (fd3/fd4) and the WSL child process.
// This is needed because wsl.exe only supports up to 3 forwarded fds, so we can't
// pass extra pipes directly and must tunnel them over a socket instead.

(async () => {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error(`Usage: node ${path.basename(__filename)} <executable> [args...]`);
    process.exit(1);
  }

  // Use net.Socket instead of fs.createReadStream/WriteStream to avoid hanging at shutdown.
  // fs streams use libuv's async fs API which spawns FSReqCallbacks in the threadpool.
  // If fs operations are pending (e.g. waiting for EOF), Node's event loop stays referenced
  // and the process never exits. net.Socket integrates with libuv's event loop directly,
  // making reads/writes non-blocking and allowing clean shutdown via destroy().
  const parentIn  = new net.Socket({ fd: 3, readable: true,  writable: false }); // parent -> us
  const parentOut = new net.Socket({ fd: 4, readable: false, writable: true  }); // us -> parent

  const server = net.createServer();

  let socket: net.Socket | null = null;
  server.on('connection', s => {
    if (socket) {
      log('Extra connection received, destroying.');
      socket.destroy();
      return;
    }
    socket = s;
    // Disable Nagle's algorithm to reduce latency for small, frequent messages.
    socket.setNoDelay(true);
    log('Client connected, wiring pipes.');

    socket.pipe(parentOut);
    parentIn.pipe(socket);

    socket.on('close', () => {
      log('Socket closed');
      socket = null;
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
    // Use actual exit code, or 128, or fallback to 1 for unknown signals
    const exitCode = code ?? (signal ? 128 : 0);
    shutdown(exitCode);
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

    server.close();

    parentIn.destroy();
    parentOut.destroy();
    socket?.destroy();

    await new Promise(resolve => server.once('close', resolve));

    process.exit(code);
  }

  function log(...args: any[]) {
    console.error(new Date(), `[${path.basename(__filename)}]`, ...args);
  }
})().catch(error => {
  console.error('Error occurred:', error);
  process.exit(1);
});
