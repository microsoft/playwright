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
import os from 'os';
import path from 'path';

import type { FullConfig } from '../browser/config';

export type ClientInfo = {
  version: string;
  workspaceDirHash: string;
  daemonProfilesDir: string;
  workspaceDir: string | undefined;
};

export type SessionConfig = {
  name: string;
  version: string;
  socketPath: string;
  cli: {
    headed?: boolean;
    extension?: boolean;
    browser?: string;
    persistent?: boolean;
    profile?: string;
    config?: string;
  };
  userDataDirPrefix?: string;
  workspaceDir?: string;
  resolvedConfig?: FullConfig
};

export type SessionEntry = {
  file: string;
  config: SessionConfig;
};

export class Registry {
  private _entries: Map<string, SessionEntry[]>;

  private constructor(entries: Map<string, SessionEntry[]>) {
    this._entries = entries;
  }

  entry(clientInfo: ClientInfo, sessionName: string): SessionEntry | undefined {
    const key = clientInfo.workspaceDir || clientInfo.workspaceDirHash;
    const entries = this._entries.get(key) || [];
    return entries.find(entry => entry.config.name === sessionName);
  }

  entries(clientInfo: ClientInfo): SessionEntry[] {
    const key = clientInfo.workspaceDir || clientInfo.workspaceDirHash;
    return this._entries.get(key) || [];
  }

  entryMap(): Map<string, SessionEntry[]> {
    return this._entries;
  }

  static async loadSessionEntry(file: string): Promise<SessionEntry | undefined> {
    try {
      const data = await fs.promises.readFile(file, 'utf-8');
      const config = JSON.parse(data) as SessionConfig;
      // Sessions from 0.1.0 support.
      if (!config.name)
        config.name = path.basename(file, '.session');
      return { file, config };
    } catch {
      return undefined;
    }
  }

  static async load(): Promise<Registry> {
    const sessions = new Map<string, SessionEntry[]>();
    const hashDirs = await fs.promises.readdir(baseDaemonDir).catch(() => []);
    for (const workspaceDirHash of hashDirs) {
      const hashDir = path.join(baseDaemonDir, workspaceDirHash);
      const stat = await fs.promises.stat(hashDir);
      if (!stat.isDirectory())
        continue;

      const files = await fs.promises.readdir(hashDir).catch(() => []);
      for (const file of files) {
        if (!file.endsWith('.session'))
          continue;
        const fileName = path.join(hashDir, file);
        const entry = await Registry.loadSessionEntry(fileName);
        if (!entry)
          continue;
        const key = entry.config.workspaceDir || workspaceDirHash;
        let list = sessions.get(key);
        if (!list) {
          list = [];
          sessions.set(key, list);
        }
        list.push(entry);
      }
    }
    return new Registry(sessions);
  }
}

export const baseDaemonDir = (() => {
  if (process.env.PLAYWRIGHT_DAEMON_SESSION_DIR)
    return process.env.PLAYWRIGHT_DAEMON_SESSION_DIR;

  let localCacheDir: string | undefined;
  if (process.platform === 'linux')
    localCacheDir = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  if (process.platform === 'darwin')
    localCacheDir = path.join(os.homedir(), 'Library', 'Caches');
  if (process.platform === 'win32')
    localCacheDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  if (!localCacheDir)
    throw new Error('Unsupported platform: ' + process.platform);
  return path.join(localCacheDir, 'ms-playwright', 'daemon');
})();
