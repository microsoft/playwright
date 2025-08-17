// Copyright (c) Microsoft Corporation.
//
// Tiny helper that:
// 1. Starts a TCP server (single connection) used as a transport.
// 2. Exposes its port to the spawned child process via PW_WKWSL_PORT env var
//    (and marks it for propagation with WSLENV when crossing Windows <-> WSL).
// 3. Bridges between parent-side pipe fd3/fd4 and the accepted TCP socket.
// 4. Spawns the target executable passed on the CLI (first arg), forwarding
//    remaining args, and performs robust cleanup on exit / signals.
// @ts-check
import net from 'net'
import fs from 'fs'
import {spawn} from "child_process"
import path from 'path'

function log(...args) {
  console.error(new Date(), '[webkit-wsl-host-wrapper]', ...args);
}


async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error('Usage: node webkit-wsl-host-wrapper.mjs <executable> [args...]');
    process.exit(1);
  }

	const parentIn  = new net.Socket({ fd: 3, readable: true,  writable: false }); // parent -> us
	const parentOut = new net.Socket({ fd: 4, readable: false, writable: true  }); // us -> parent

  const server = net.createServer({ /* default hwm is fine */ });

  const sockets = new Set();
  server.on('connection', socket => {
    if (sockets.size > 0) {
      log('Extra connection received, destroying.');
      socket.destroy();
      return;
    }
    sockets.add(socket);
    log('Client connected, wiring pipes.');

    // socket -> parentOut (normal pipe, no end)
    socket.pipe(parentOut, { end: false });

    // parentIn -> socket (manual pump so we can cancel cleanly)
    parentIn.pipe(socket, { end: false });

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

  // Spawn child process with augmented env (propagate port + mark for WSL env forwarding when needed).
  const env = {
    ...process.env,
		WSLENV: 'PW_WKWSL_PORT',
    PW_WKWSL_PORT: String(port),
    WEBKIT_EXECUTABLE: undefined,
  };

  let shuttingDown = false;

  const child = spawn('wsl.exe', [
     '-d',
    'playwright',
    '--cd',
    '/home/pwuser',
    '/home/pwuser/node/bin/node',
    '/home/pwuser/webkit-wsl-transport-client.mjs',
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

  // Wait for child close to make `main()` awaitable
  await new Promise(resolve => child.once('close', resolve));

  async function shutdown(code = 0) {
    if (shuttingDown)
			return;
    shuttingDown = true;

    parentIn.destroy()
    parentOut.destroy()

    // Close listener and destroy any sockets
    await new Promise((resolve) => server.close(() => resolve(null)));
    for (const socket of sockets) socket.destroy();
  }
}

main().catch(e => {
  console.error('Fatal wrapper error:', e);
  process.exit(1);
});