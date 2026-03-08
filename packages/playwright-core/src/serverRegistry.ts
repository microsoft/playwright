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

import type { Browser } from './server/browser';
import type { LaunchOptions } from './server/types';
import type { BrowserName } from './server/registry/index';

const packageVersion = require('../package.json').version;

export type BrowserInfo = {
  title: string;
  wsEndpoint?: string;
  pipeName?: string;
  workspaceDir?: string;
};

export type BrowserDescriptor = BrowserInfo & {
  playwrightVersion: string;
  playwrightLib: string;
  browser: {
    browserName: BrowserName;
    launchOptions: LaunchOptions;
  };
};

type BrowserEntry = BrowserDescriptor & {
  canConnect: boolean;
  file: string;
};

class ServerRegistry {
  async list(options?: { gc?: boolean }): Promise<Map<string, BrowserDescriptor[]>> {
    const files = await fs.promises.readdir(this._browsersDir()).catch(() => []);
    const result = new Map<string, Promise<BrowserEntry>[]>();
    for (const file of files) {
      try {
        const filePath = path.join(this._browsersDir(), file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const descriptor: BrowserDescriptor = JSON.parse(content);
        const key = descriptor.workspaceDir ?? '';
        let list = result.get(key);
        if (!list) {
          list = [];
          result.set(key, list);
        }
        list.push(canConnect(descriptor).then(connectable => ({ ...descriptor, canConnect: connectable, file: filePath })));
      } catch {
      }
    }

    const resolvedResult = new Map<string, BrowserEntry[]>();
    for (const [key, promises] of result) {
      const entries = await Promise.all(promises);
      if (options?.gc) {
        for (const entry of entries) {
          if (!entry.canConnect)
            await fs.promises.unlink(entry.file).catch(() => {});
        }
      }
      const list = entries.filter(entry => entry.canConnect);
      if (list.length)
        resolvedResult.set(key, list);
    }
    return resolvedResult;
  }

  async create(browser: Browser, info: BrowserInfo): Promise<void> {
    const file = path.join(this._browsersDir(), browser.guid);
    await fs.promises.mkdir(this._browsersDir(), { recursive: true });
    const descriptor: BrowserDescriptor = {
      playwrightVersion: packageVersion,
      playwrightLib: require.resolve('..'),
      title: info.title,
      browser: {
        browserName: browser.options.browserType,
        launchOptions: browser.options.originalLaunchOptions,
      },
      wsEndpoint: info.wsEndpoint,
      pipeName: info.pipeName,
      workspaceDir: info.workspaceDir,
    };
    await fs.promises.writeFile(file, JSON.stringify(descriptor), 'utf-8');
  }

  async delete(browser: Browser): Promise<void> {
    const file = path.join(this._browsersDir(), browser.guid);
    await fs.promises.unlink(file).catch(() => {});
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
}

async function canConnect(descriptor: BrowserDescriptor): Promise<boolean> {
  if (descriptor.pipeName) {
    return await new Promise(resolve => {
      const socket = net.createConnection(descriptor.pipeName!, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
  }
  return false;
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
