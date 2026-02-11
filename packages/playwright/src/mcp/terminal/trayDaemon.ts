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

import { openUrlInApp, ProgressController } from 'playwright-core/lib/server';
import { gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';

import { createClientInfo, Session } from './program';
import { Registry } from './registry';

import type { SessionEntry } from './registry';
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
const idToEntry = new Map<string, SessionEntry>();

async function onMenuRequested(): Promise<MenuItem[]> {
  const registry = await Registry.load();
  const map = registry.entryMap();
  const items: MenuItem[] = [];
  let first = true;
  idToEntry.clear();
  for (const [workspace, entries] of map) {
    if (!first)
      items.push({ id: '', separator: true });
    first = false;
    const shortName = path.basename(workspace);
    items.push({ id: '', title: shortName, enabled: false });
    for (const entry of entries) {
      idToEntry.set(String(++lastId), entry);
      items.push({
        id: ``,
        title: entry.config.name,
        items: [
          { id: `show:${lastId}`, title: 'Show' },
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
      if (id.startsWith('show:'))
        show(idToEntry.get(id.substring('show:'.length))).catch(() => {});
      if (id.startsWith('close:')) {
        const entry = idToEntry.get(id.substring('close:'.length));
        if (entry)
          new Session(createClientInfo(), entry.config).stop().catch(() => {});
      }
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

async function runShow(entry: SessionEntry): Promise<string | undefined> {
  const s = new Session(createClientInfo(), entry.config);
  const { text } = await s.run({ _: ['show'] });
  return text.match(/Show server is listening on: (.+)/)?.[1];
}

async function show(entry: SessionEntry | undefined) {
  if (!entry)
    return;
  const url = await runShow(entry);
  if (!url)
    return;

  const page = await openUrlInApp(url, { name: 'devtools' }).catch(() => null);
  if (!page)
    return;

  let closed = false;
  page.on('close', () => {
    closed = true;
  });

  while (!closed) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (closed)
      break;
    try {
      const freshEntry = await Registry.loadSessionEntry(entry.file);
      if (!freshEntry)
        continue;
      const newUrl = await runShow(freshEntry);
      if (!newUrl)
        continue;
      const controller = new ProgressController();
      await controller.run(async progress => {
        await page.mainFrame().goto(progress, newUrl);
      });
    } catch {
      // Session might be restarting, try again next poll.
    }
  }
}

void main();
