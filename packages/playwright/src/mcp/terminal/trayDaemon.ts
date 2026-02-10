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

import fs from 'fs';
import net from 'net';
import path from 'path';
import os from 'os';
import { gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';

import { createClientInfo, Session } from './program';
import { Registry } from './registry';

import type { SessionConfig } from './registry';
import type { MenuItem } from '@trayjs/trayjs';

const socketsDir = process.env.PLAYWRIGHT_DAEMON_SOCKETS_DIR || path.join(os.tmpdir(), 'playwright-cli');

const socketPath = process.platform === 'win32'
  ? `\\\\.\\pipe\\playwright-tray-${process.env.USERNAME || 'default'}`
  : path.join(socketsDir, 'tray.sock');

function acquireSingleton(): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(socketPath, () => resolve(server));
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE')
        return reject(err);
      const client = net.connect(socketPath, () => {
        client.destroy();
        reject(new Error('already running'));
      });
      client.on('error', () => {
        fs.unlinkSync(socketPath);
        server.listen(socketPath, () => resolve(server));
      });
    });
  });
}

let lastId = 0;
const idToConfig = new Map<string, SessionConfig>();

async function onMenuRequested(): Promise<MenuItem[]> {
  const registry = await Registry.load();
  const map = registry.configMap();
  const items: MenuItem[] = [];
  let first = true;
  idToConfig.clear();
  for (const [workspace, configs] of map) {
    if (!first)
      items.push({ id: '', separator: true });
    first = false;
    const shortName = path.basename(workspace);
    items.push({ id: '', title: shortName, enabled: false });
    for (const config of configs) {
      idToConfig.set(String(++lastId), config);
      items.push({
        id: ``,
        title: config.name,
        items: [
          { id: `close:${lastId}`, title: 'Close' },
        ],
      });
    }
  }

  if (!items.length)
    items.push({ id: '', title: 'No sessions', enabled: false });

  items.push({ id: '', separator: true });
  items.push({ id: 'quit', title: 'Quit' });
  return items;
}

async function main() {
  let server: net.Server;
  try {
    server = await acquireSingleton();
  } catch {
    return;
  }

  const { Tray } = await import('@trayjs/trayjs');

  const tray = new Tray({
    tooltip: 'Playwright',
    icon: {
      png: path.join(__dirname, 'icon.png'),
      ico: path.join(__dirname, 'icon.ico'),
    },
    onClicked: (id: string) => {
      if (id === 'quit')
        tray.quit();
      if (id.startsWith('close:'))
        session(id.substring('close:'.length))?.stop().catch(() => {});
    },
    onMenuRequested,
  });

  const shutdown = () => {
    server.close();
    tray.quit();
  };
  tray.on('ready', () => {});
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  tray.on('close', () => gracefullyProcessExitDoNotHang(0));
}

function session(id: string): Session | undefined {
  const config = idToConfig.get(id);
  if (!config)
    return;
  const clientInfo = createClientInfo();
  return new Session(clientInfo, config);
}

void main();
