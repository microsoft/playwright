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
// @ts-check
/* eslint-disable no-restricted-properties */
/* eslint-disable no-console */

// WebKit WSL Transport Client - runs inside WSL/Linux
// See webkit-wsl-transport-server.ts for the complete architecture diagram.
// This client connects to the TCP server and bridges it to WebKit via fd3/fd4 pipes.

import net from 'net';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';

(async () => {
  const { PW_WSL_BRIDGE_PORT: socketPort, ...childEnv } = process.env;
  if (!socketPort)
    throw new Error('PW_WSL_BRIDGE_PORT env var is not set');

  const [executable, ...args] = process.argv.slice(2);

  if (!(await fs.promises.stat(executable)).isFile())
    throw new Error(`Executable does not exist. Did you update Playwright recently? Make sure to run npx playwright install webkit-wsl`);

  const address = (() => {
    const res = spawnSync('/usr/bin/wslinfo', ['--networking-mode'], { encoding: 'utf8' });
    if (res.error || res.status !== 0)
      throw new Error(`Failed to run /usr/bin/wslinfo --networking-mode: ${res.error?.message || res.stderr || res.status}`);
    if (res.stdout.trim() === 'nat') {
      const ipRes = spawnSync('/usr/sbin/ip', ['route', 'show'], { encoding: 'utf8' });
      if (ipRes.error || ipRes.status !== 0)
        throw new Error(`Failed to run ip route show: ${ipRes.error?.message || ipRes.stderr || ipRes.status}`);
      const ip = ipRes.stdout.trim().split('\n').find(line => line.includes('default'))?.split(' ')[2];
      if (!ip)
        throw new Error('Could not determine WSL IP address (NAT mode).');
      return ip;
    }
    return '127.0.0.1';
  })();

  const socket = net.createConnection(parseInt(socketPort, 10), address);
  // Disable Nagle's algorithm to reduce latency for small, frequent messages.
  socket.setNoDelay(true);

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('error', reject);
  });

  const child = spawn(executable, args, {
    stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe'],
    env: childEnv,
  });

  const [childOutput, childInput] = [child.stdio[3] as NodeJS.WritableStream, child.stdio[4] as NodeJS.ReadableStream];
  socket.pipe(childOutput);
  childInput.pipe(socket);

  socket.on('end', () => child.kill());

  child.on('exit', exitCode => {
    socket.end();
    process.exit(exitCode || 0);
  });

  await new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
  });
})().catch(error => {
  console.error('Error occurred:', error);
  process.exit(1);
});
