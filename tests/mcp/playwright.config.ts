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

import { defineConfig } from '@playwright/test';

import type { TestOptions } from './fixtures';

export default defineConfig<TestOptions>({
  testDir: './',
  grepInvert: /extension/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  projects: [
    { name: 'chrome' },
    { name: 'chromium', use: { mcpBrowser: 'chromium' } },
    ...process.env.MCP_IN_DOCKER ? [{
      name: 'chromium-docker',
      grep: /browser_navigate|browser_click/,
      use: {
        mcpBrowser: 'chromium',
        mcpMode: 'docker' as const
      }
    }] : [],
    { name: 'firefox', use: { mcpBrowser: 'firefox' } },
    { name: 'webkit', use: { mcpBrowser: 'webkit' } },
    ... process.platform === 'win32' ? [{ name: 'msedge', use: { mcpBrowser: 'msedge' } }] : [],
  ],
});
