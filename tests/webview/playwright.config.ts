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

import { config as loadEnv } from 'dotenv';
loadEnv({ path: path.join(__dirname, '..', '..', '.env') });
process.env.PWTEST_UNDER_TEST = '1';

import type { Config, PlaywrightTestOptions, PlaywrightWorkerOptions } from '@playwright/test';
import * as path from 'path';
import type { ServerWorkerOptions } from '../config/serverFixtures';

process.env.PWPAGE_IMPL = 'webkit-webview';

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const testDir = path.join(__dirname, '..');
const config: Config<ServerWorkerOptions & PlaywrightWorkerOptions & PlaywrightTestOptions> = {
  testDir,
  outputDir,
  expect: {
    timeout: 10000,
  },
  timeout: 30000,
  globalTimeout: 7200000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [
    ['list', { printFailuresInline: true }],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
  ] : 'line',
  projects: [],
};

const metadata = {
  platform: 'WebView',
  headless: 'headless',
  browserName: 'webkit',
  mode: 'default',
  video: false,
};

// macOS drives Mobile Safari in the iOS Simulator via ios_webkit_debug_proxy;
// Linux drives a WebKitGTK/WPE browser (Epiphany, MiniBrowser, ...) over its
// remote inspector HTTP server. Both share the same page tests and connectOverCDP
// transport; only the discovery/launch differs (see webviewTest.ts).
const isLinux = process.platform === 'linux';
const projectName = isLinux ? 'webkit-webview-gtk-page' : 'webkit-webview-page';
const snapshotSuffix = isLinux ? 'webkit-webview-gtk' : 'webkit-webview';

config.projects!.push({
  name: projectName,
  use: {
    browserName: 'webkit',
  },
  snapshotPathTemplate: `{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-${snapshotSuffix}{ext}`,
  testDir: path.join(testDir, 'page'),
  metadata,
});

export default config;
