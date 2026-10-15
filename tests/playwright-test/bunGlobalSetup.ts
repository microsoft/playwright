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
import path from 'path';

import type { FullConfig } from './stable-test-runner';

async function globalSetup(config: FullConfig) {
  const nodeModulesDir = path.join(__dirname, '..', 'bun-runner', 'node_modules');
  if (!fs.existsSync(nodeModulesDir))
    throw new Error('Run "npm run stage-bun-runner" first');
  for (const outputDir of new Set(config.projects.map(p => p.outputDir))) {
    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.symlink(nodeModulesDir, path.join(outputDir, 'node_modules'), 'junction');
  }
}

export default globalSetup;
