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

export class Registry {
  private _configs: Map<string, SessionConfig[]>;

  private constructor(configs: Map<string, SessionConfig[]>) {
    this._configs = configs;
  }

  config(clientInfo: ClientInfo, sessionName: string): SessionConfig | undefined {
    const key = clientInfo.workspaceDir || clientInfo.workspaceDirHash;
    const configs = this._configs.get(key) || [];
    return configs.find(config => config.name === sessionName);
  }

  configs(clientInfo: ClientInfo): SessionConfig[] {
    const key = clientInfo.workspaceDir || clientInfo.workspaceDirHash;
    return this._configs.get(key) || [];
  }

  configMap(): Map<string, SessionConfig[]> {
    return this._configs;
  }

  static async load(): Promise<Registry> {
    const sessions = new Map<string, SessionConfig[]>();
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
        const sessionName = path.basename(file, '.session');
        const sessionConfig = await fs.promises.readFile(fileName, 'utf-8').then(data => JSON.parse(data)) as SessionConfig;
        // Support for 0.1.0 where session name was not stored in the file.
        if (!sessionConfig.name)
          sessionConfig.name = sessionName;
        const key = sessionConfig.workspaceDir || workspaceDirHash;
        let list = sessions.get(key);
        if (!list) {
          list = [];
          sessions.set(key, list);
        }
        list.push(sessionConfig);
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
