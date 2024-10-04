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

import { test } from '@playwright/test';
import os from 'os';

export type PlatformWorkerFixtures = {
  platform: 'win32' | 'darwin' | 'linux';
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  macVersion: number; // major only, 11 or later, zero if not mac
};

function platform(): 'win32' | 'darwin' | 'linux' {
  if (process.env.PLAYWRIGHT_SERVICE_OS === 'linux')
    return 'linux';
  if (process.env.PLAYWRIGHT_SERVICE_OS === 'windows')
    return 'win32';
  if (process.env.PLAYWRIGHT_SERVICE_OS === 'macos')
    return 'darwin';
  return process.platform as 'win32' | 'darwin' | 'linux';
}

function macVersion() {
  if (process.platform !== 'darwin')
    return 0;
  return +os.release().split('.')[0] - 9;
}

export const platformTest = test.extend<{}, PlatformWorkerFixtures>({
  platform: [platform(), { scope: 'worker' }],
  isWindows: [platform() === 'win32', { scope: 'worker' }],
  isMac: [platform() === 'darwin', { scope: 'worker' }],
  isLinux: [platform() === 'linux', { scope: 'worker' }],
  macVersion: [macVersion(), { scope: 'worker' }],
});
