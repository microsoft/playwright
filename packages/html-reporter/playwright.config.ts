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

import path from 'path';
import url from 'url';
import { devices, defineConfig } from '@playwright/test';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outputDir = path.join(dirname, '..', '..', 'test-results');

export default defineConfig({
  testDir: 'src',
  outputDir,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { outputDir: path.join(dirname, '..', '..', 'blob-report') }],
    ['../../tests/config/parquetReporter.ts'],
  ] : [
    ['html', { open: 'on-failure' }]
  ],
  tag: process.env.PW_TAG,
  use: {
    baseURL: 'http://localhost:3101/playwright/gallery/index.html',
    serviceWorkers: 'block',
    reuseContext: true,
    trace: 'on-first-retry',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
  webServer: {
    command: 'npx vite --port 3101 --strictPort',
    url: 'http://localhost:3101/playwright/gallery/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
