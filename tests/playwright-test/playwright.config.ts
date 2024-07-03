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

import { defineConfig, type ReporterDescription } from './stable-test-runner';
import * as path from 'path';

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const reporters = () => {
  const result: ReporterDescription[] = process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
    ['blob', { outputDir: path.join(__dirname, '..', '..', 'blob-report'), fileName: `${process.env.PWTEST_BOT_NAME}.zip` }],
  ] : [
    ['list']
  ];
  return result;
};
export default defineConfig({
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'playwright-test',
      testDir: __dirname,
      testIgnore: ['assets/**', 'stable-test-runner/**'],
    },
    {
      name: 'image_tools',
      testDir: path.join(__dirname, '../image_tools'),
      testIgnore: [path.join(__dirname, '../fixtures/**')],
    },
  ],
  reporter: reporters(),
  metadata: {
    clock: process.env.PW_CLOCK ? 'clock-' + process.env.PW_CLOCK : undefined,
  },
});
