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
import { defineConfig } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: path.join(__dirname, '..', '..', '.env') });

const reporters = () => {
  const result: ReporterDescription[] = process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { fileName: `${process.env.PWTEST_BOT_NAME}.zip` }],
  ] : [
    ['list'],
    ['html', { open: 'on-failure' }]
  ];
  return result;
};

const outputDir = path.join(__dirname, '..', '..', 'test-results');
export default defineConfig({
  globalSetup: path.join(__dirname, 'globalSetup'),
  outputDir,
  testIgnore: '**\/fixture-scripts/**',
  timeout: 5 * 60 * 1000,
  retries: 0,
  reporter: reporters(),
  forbidOnly: !!process.env.CI,
  workers: 1,
  projects: [
    {
      name: 'installation tests',
      metadata: {
        nodejsVersion: process.version,
      },
    },
  ],
});
