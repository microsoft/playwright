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

import { Config } from './stable-test-runner';
import * as path from 'path';

const outputDir = path.join(__dirname, '..', '..', 'test-results');
const config: Config = {
  testDir: __dirname,
  testIgnore: ['assets/**', 'stable-test-runner/**'],
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  preserveOutput: process.env.CI ? 'failures-only' : 'always',
  projects: process.env.PLAYWRIGHT_DOCKER ? [
    { name: 'visual tests', testMatch: ['*.visual.ts'] },
  ] : [
    { name: 'playwright-test', testIgnore: ['*.visual.ts'] },
  ],
  reporter: process.env.CI ? [
    ['dot'],
    ['json', { outputFile: path.join(outputDir, 'report.json') }],
  ] : [
    ['list']
  ],
};

export default config;
