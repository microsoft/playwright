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

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.join(__dirname, 'node_modules');
const testsNodeModulesDir = path.join(__dirname, '..', 'node_modules');

if (!fs.existsSync(nodeModulesDir)) {
  console.error('Run "npm run stage-bun-runner" first');
  process.exit(1);
}

fs.rmSync(testsNodeModulesDir, { force: true });
fs.symlinkSync(nodeModulesDir, testsNodeModulesDir, 'junction');
process.on('SIGINT', () => {});
const child = spawn('bun', [path.join(nodeModulesDir, '@playwright', 'test', 'cli.js'), ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', code => {
  fs.rmSync(testsNodeModulesDir, { force: true });
  process.exit(code ?? 1);
});
