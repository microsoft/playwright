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

const fs = require('fs');
const path = require('path');
const { utils } = require('../../packages/playwright-core/lib/coreBundle');

const { spawnAsync, removeFolders } = utils;

const PACKAGE_BUILDER_SCRIPT = path.join(__dirname, '..', '..', 'utils', 'pack_package.js');

async function stage() {
  const stagingDir = path.join(__dirname, '.staging');
  await removeFolders([stagingDir, path.join(__dirname, 'node_modules')]);
  await fs.promises.mkdir(stagingDir, { recursive: true });

  await Promise.all(['playwright-core', 'playwright', 'playwright-test'].map(async packageName => {
    const { code, stderr, stdout } = await spawnAsync('node', [PACKAGE_BUILDER_SCRIPT, packageName, path.join(stagingDir, `${packageName}.tgz`)]);
    if (code)
      throw new Error(`Failed to pack ${packageName}:\n${stderr}\n${stdout}`);
  }));

  const { code, stderr, stdout } = await spawnAsync('npm', ['install', '--package-lock=false', '--fund=false', '--audit=false'], { cwd: __dirname, shell: process.platform === 'win32' });
  if (code)
    throw new Error(`Failed to install current test runner:\n${stderr}\n${stdout}`);
}

stage().catch(e => {
  console.error(e);
  process.exit(1);
});
