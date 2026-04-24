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

import os from 'os';
import path from 'path';

export function defaultUserDataDirForChannel(channel: string): string | undefined {
  return channelToDefaultUserDataDir.get(channel)?.[process.platform];
}

export function isChromiumChannelName(channel: string): boolean {
  return channelToDefaultUserDataDir.has(channel);
}

const channelToDefaultUserDataDir = new Map<string, Record<string, string>>([
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
