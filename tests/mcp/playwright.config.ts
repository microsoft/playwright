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
import * as path from 'path';
import dotenv from 'dotenv';

import { defineConfig } from '@playwright/test';

import type { TestOptions } from './fixtures';
import type { ReporterDescription } from '@playwright/test';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const rootTestDir = path.join(__dirname, '..');
const testDir = path.join(rootTestDir, 'mcp');
const outputDir = path.join(__dirname, '..', '..', 'test-results');

const reporters = () => {
  const result: ReporterDescription[] = process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { outputDir: path.join(__dirname, '..', '..', 'blob-report') }],
  ] : [
    ['list']
  ];
  return result;
};

const metadata = {
  platform: process.platform,
  headless: 'headless',
  mode: 'default',
  video: false,
};

export default defineConfig<TestOptions>({
  testDir: rootTestDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 3 : undefined,
  reporter: reporters(),
  tag: process.env.PW_TAG,
  projects: [
    { name: 'chrome', metadata: { ...metadata, browserName: 'chromium', channel: 'chrome' }, testDir },
    { name: 'chromium', use: { mcpBrowser: 'chromium' }, metadata: { ...metadata, browserName: 'chromium' }, testDir },
    { name: 'firefox', use: { mcpBrowser: 'firefox' }, metadata: { ...metadata, browserName: 'firefox' }, testDir },
    { name: 'webkit', use: { mcpBrowser: 'webkit' }, metadata: { ...metadata, browserName: 'webkit' }, testDir },
    ... process.platform === 'win32' ? [{ name: 'msedge', use: { mcpBrowser: 'msedge' }, metadata: { ...metadata, browserName: 'chromium', channel: 'msedge' }, testDir }] : [],
  ],
});
