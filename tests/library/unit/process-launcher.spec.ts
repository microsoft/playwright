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
import { test, expect } from '@playwright/test';
import { launchProcess } from '../../../packages/utils/processLauncher';

test('launchProcess cleans up temp directories on kill', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pw-test-cleanup-'));
  const { kill } = await launchProcess({
    command: process.execPath,
    args: ['-e', 'setInterval(() => {}, 1000)'],
    stdio: 'pipe',
    tempDirectories: [tempDir],
    attemptToGracefullyClose: async () => {},
    onExit: () => {},
    log: () => {},
  });
  expect(fs.existsSync(tempDir)).toBe(true);
  await kill();
  expect(fs.existsSync(tempDir)).toBe(false);
});
