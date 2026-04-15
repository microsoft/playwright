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

import { EventEmitter } from 'events';
import fs from 'fs';
import net from 'net';
import path from 'path';
import os from 'os';
import chokidar from 'chokidar';

import { packageJSON, packageRoot } from './package';

// Only client depenencies with backward compatibility guarantees should be imported here.
import type { LaunchOptions } from '../types/types';

const packageVersion = packageJSON.version;

export type BrowserInfo = {
  guid: string;
  browserName: 'chromium' | 'firefox' | 'webkit';
  userDataDir?: string;
  launchOptions: LaunchOptions;
};

export type EndpointInfo = {
  title: string;
  endpoint?: string;
  workspaceDir?: string;
  metadata?: Record<string, any>;
};

export type BrowserDescriptor = EndpointInfo & {
  playwrightVersion: string;
  playwrightLib: string;
  browser: BrowserInfo;
};

export type BrowserStatus = BrowserDescriptor & { canConnect: boolean };

export interface ServerRegistryEvents {
  added: (descriptor: BrowserDescriptor) => void;
  removed: (guid: string) => void;
  changed: (descriptor: BrowserDescriptor) => void;
}

class ServerRegistry extends EventEmitter {
  private _descriptors = new Map<string, BrowserDescriptor>();
  private _watcher: chokidar.FSWatcher | undefined;
  private _watcherRefs = 0;
  private _ready: Promise<void> | undefined;

  override on<K extends keyof ServerRegistryEvents>(event: K, listener: ServerRegistryEvents[K]): this {
    return super.on(event, listener as (...args: any[]) => void);
  }

  override off<K extends keyof ServerRegistryEvents>(event: K, listener: ServerRegistryEvents[K]): this {
    return super.off(event, listener as (...args: any[]) => void);
  }

  watch(): () => void {
    this._watcherRefs++;
    if (!this._watcher)
      this._startWatcher();
    let disposed = false;
    return () => {
      if (disposed)
        return;
      disposed = true;
      this._watcherRefs--;
      if (this._watcherRefs === 0)
        this._stopWatcher();
    };
  }

  ready(): Promise<void> {
    return this._ready ?? Promise.resolve();
  }

  async list(): Promise<Map<string, BrowserStatus[]>> {
    const ownWatcher = !this._watcher;
    let dispose: (() => void) | undefined;
    if (ownWatcher)
      dispose = this.watch();
    try {
      await this._ready;
      const statuses = await Promise.all(
          [...this._descriptors.values()].map(async descriptor => {
            const canConnect = await canConnectTo(descriptor);
            return { descriptor, canConnect };
          }),
      );
      const result = new Map<string, BrowserStatus[]>();
      for (const { descriptor, canConnect } of statuses) {
        if (!canConnect) {
          await fs.promises.unlink(path.join(this._browsersDir(), descriptor.browser.guid)).catch(() => {});
          continue;
        }
        const key = descriptor.workspaceDir ?? '';
        let list = result.get(key);
        if (!list) {
          list = [];
          result.set(key, list);
        }
        list.push({ ...descriptor, canConnect });
      }
      return result;
    } finally {
      dispose?.();
    }
  }

  async create(browser: BrowserInfo, endpoint: EndpointInfo) {
    const file = path.join(this._browsersDir(), browser.guid);
    await fs.promises.mkdir(this._browsersDir(), { recursive: true });
    const descriptor: BrowserDescriptor = {
      playwrightVersion: packageVersion,
      playwrightLib: packageRoot,
      title: endpoint.title,
      browser,
      endpoint: endpoint.endpoint,
      workspaceDir: endpoint.workspaceDir,
    };
    await fs.promises.writeFile(file, JSON.stringify(descriptor), 'utf-8');
  }

  async delete(guid: string): Promise<void> {
    const file = path.join(this._browsersDir(), guid);
    await fs.promises.unlink(file).catch(() => {});
  }

  async deleteUserData(guid: string): Promise<void> {
    const filePath = path.join(this._browsersDir(), guid);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const descriptor: BrowserDescriptor = JSON.parse(content);
    if (descriptor.browser.userDataDir)
      await fs.promises.rm(descriptor.browser.userDataDir, { recursive: true, force: true });
    await fs.promises.unlink(filePath);
  }

  readDescriptor(guid: string): BrowserDescriptor {
    const cached = this._descriptors.get(guid);
    if (cached)
      return cached;
    const filePath = path.join(this._browsersDir(), guid);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async find(name: string): Promise<BrowserDescriptor | null> {
    const entries = await this.list();
    for (const [, browsers] of entries) {
      for (const browser of browsers) {
        if (browser.title === name)
          return browser;
      }
    }
    return null;
  }

  private _browsersDir() {
    return process.env.PLAYWRIGHT_SERVER_REGISTRY || registryDirectory;
  }

  private _startWatcher() {
    const dir = this._browsersDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
    }
    const watcher = chokidar.watch(dir, {
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    });
    this._watcher = watcher;
    this._ready = new Promise<void>((resolve, reject) => {
      watcher.once('ready', () => resolve());
      watcher.once('error', reject);
    });
    watcher.on('add', file => this._onAddOrChange(file, 'added'));
    watcher.on('change', file => this._onAddOrChange(file, 'changed'));
    watcher.on('unlink', file => {
      const guid = path.basename(file);
      if (this._descriptors.delete(guid))
        this.emit('removed', guid);
    });
  }

  private _onAddOrChange(file: string, event: 'added' | 'changed') {
    const guid = path.basename(file);
    let descriptor: BrowserDescriptor;
    try {
      descriptor = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return;
    }
    this._descriptors.set(guid, descriptor);
    this.emit(event, descriptor);
  }

  private _stopWatcher() {
    const watcher = this._watcher;
    this._watcher = undefined;
    this._ready = undefined;
    this._descriptors.clear();
    void watcher?.close();
  }
}

async function canConnectTo(descriptor: BrowserDescriptor): Promise<boolean> {
  if (!descriptor.endpoint)
    return false;
  if (descriptor.endpoint.startsWith('ws://') || descriptor.endpoint.startsWith('wss://')) {
    return await new Promise(resolve => {
      const url = new URL(descriptor.endpoint!);
      const socket = net.createConnection(Number(url.port), url.hostname, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
  }
  return await new Promise(resolve => {
    const socket = net.createConnection(descriptor.endpoint ?? (descriptor as any).pipeName, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

const defaultCacheDirectory = (() => {
  if (process.platform === 'linux')
    return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  throw new Error('Unsupported platform: ' + process.platform);
})();

const registryDirectory = path.join(defaultCacheDirectory, 'ms-playwright', 'b');

export const serverRegistry = new ServerRegistry();
