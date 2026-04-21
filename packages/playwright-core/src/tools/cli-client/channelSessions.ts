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
import os from 'os';
import path from 'path';

export type ChannelSession = {
  channel: string;
  userDataDir: string;
  endpoint?: string;
  extensionInstalled: boolean;
};

// Keep in sync with the id declared via "key" in packages/extension/manifest.json
// and the hardcoded url in packages/playwright-core/src/tools/mcp/cdpRelay.ts.
const playwrightExtensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';

export const playwrightExtensionInstallUrl = `https://chromewebstore.google.com/detail/playwright-mcp-bridge/${playwrightExtensionId}`;

export async function listChannelSessions(): Promise<ChannelSession[]> {
  if (process.env.PWTEST_CLI_CHANNEL_SCAN_DISABLED_FOR_TEST)
    return [];
  const result: ChannelSession[] = [];
  for (const [channel, dirs] of channelToUserDataDir) {
    const userDataDir = dirs[process.platform];
    if (!userDataDir)
      continue;
    if (!await pathExists(userDataDir))
      continue;
    const [endpoint, extensionInstalled] = await Promise.all([
      readEndpoint(userDataDir),
      hasPlaywrightExtension(userDataDir),
    ]);
    result.push({ channel, userDataDir, endpoint, extensionInstalled });
  }
  return result;
}

async function hasPlaywrightExtension(userDataDir: string): Promise<boolean> {
  return await pathExists(path.join(userDataDir, 'Default', 'Extensions', playwrightExtensionId));
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readEndpoint(userDataDir: string): Promise<string | undefined> {
  let contents: string;
  try {
    contents = await fs.promises.readFile(path.join(userDataDir, 'DevToolsActivePort'), 'utf-8');
  } catch {
    return undefined;
  }
  const port = parseInt(contents.trim().split('\n')[0], 10);
  if (!Number.isFinite(port))
    return undefined;
  if (!await isPortOpen(port))
    return undefined;
  return `http://localhost:${port}`;
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.createConnection(port, '127.0.0.1');
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(250, () => done(false));
  });
}

// Keep in sync with channelToUserDataDir in
// packages/playwright-core/src/server/chromium/chromium.ts.
const channelToUserDataDir = new Map<string, Record<string, string>>([
  ['chrome', {
    'linux': path.join(os.homedir(), '.config', 'google-chrome'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome', 'User Data'),
  }],
  ['chrome-beta', {
    'linux': path.join(os.homedir(), '.config', 'google-chrome-beta'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome Beta'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome Beta', 'User Data'),
  }],
  ['chrome-dev', {
    'linux': path.join(os.homedir(), '.config', 'google-chrome-unstable'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome Dev'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome Dev', 'User Data'),
  }],
  ['chrome-canary', {
    'linux': path.join(os.homedir(), '.config', 'google-chrome-canary'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome Canary'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome SxS', 'User Data'),
  }],
  ['msedge', {
    'linux': path.join(os.homedir(), '.config', 'microsoft-edge'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge', 'User Data'),
  }],
  ['msedge-beta', {
    'linux': path.join(os.homedir(), '.config', 'microsoft-edge-beta'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge Beta'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge Beta', 'User Data'),
  }],
  ['msedge-dev', {
    'linux': path.join(os.homedir(), '.config', 'microsoft-edge-dev'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge Dev'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge Dev', 'User Data'),
  }],
  ['msedge-canary', {
    'linux': path.join(os.homedir(), '.config', 'microsoft-edge-canary'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge Canary'),
    'win32': path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge SxS', 'User Data'),
  }],
]);
