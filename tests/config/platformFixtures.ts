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

export type PlatformWorkerFixtures = {
  platform: 'win32' | 'darwin' | 'linux';
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
};

export const platformTest = test.extend<{}, PlatformWorkerFixtures>({
  platform: [process.platform as 'win32' | 'darwin' | 'linux', { scope: 'worker' }],
  isWindows: [process.platform === 'win32', { scope: 'worker' }],
  isMac: [process.platform === 'darwin', { scope: 'worker' }],
  isLinux: [process.platform === 'linux', { scope: 'worker' }],
});
