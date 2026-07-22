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

import { playwrightTest as test, expect } from '../config/browserTest';
import { spawnSync } from 'child_process';
import path from 'path';

const playwrightCorePath = path.join(__dirname, '..', '..', 'packages', 'playwright-core');

// Importing playwright-core while pretending to run on an unsupported platform
// (e.g. Android/Termux, where `process.platform === 'android'`).
function requireCoreOnAndroid(browsersPath: string | undefined): { status: number | null, output: string } {
  const script = [
    `Object.defineProperty(process, 'platform', { value: 'android' });`,
    `require(${JSON.stringify(playwrightCorePath)});`,
    `console.log('PLAYWRIGHT_CORE_LOADED');`,
  ].join('\n');
  const env = { ...process.env };
  delete env.PLAYWRIGHT_BROWSERS_PATH;
  if (browsersPath !== undefined)
    env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8', env });
  return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

test('should import on an unsupported platform when PLAYWRIGHT_BROWSERS_PATH=0', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41852' },
}, () => {
  const { status, output } = requireCoreOnAndroid('0');
  expect(output).not.toContain('Unsupported platform');
  expect(output).toContain('PLAYWRIGHT_CORE_LOADED');
  expect(status).toBe(0);
});

test('should import on an unsupported platform with an explicit PLAYWRIGHT_BROWSERS_PATH', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41852' },
}, () => {
  const { status, output } = requireCoreOnAndroid(path.join(test.info().outputDir, 'pw-browsers'));
  expect(output).not.toContain('Unsupported platform');
  expect(output).toContain('PLAYWRIGHT_CORE_LOADED');
  expect(status).toBe(0);
});
