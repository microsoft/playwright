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

import { devices, defineConfig } from '@playwright/experimental-ct-react';
import path from 'path';
import url from 'url';

export default defineConfig({
  testDir: 'src',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  reporter: process.env.CI ? 'blob' : 'html',
  use: {
    ctPort: 3101,
    ctViteConfig: {
      resolve: {
        alias: {
          '@web': path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../web/src'),
        },
      }
    },
    trace: 'on-first-retry',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
});
