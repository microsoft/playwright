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

const child_process = require('child_process');
const path = require('path');

const files = [
  path.join('src', 'server', 'injected', 'injectedScript.webpack.config.js'),
  path.join('src', 'server', 'injected', 'utilityScript.webpack.config.js'),
  path.join('src', 'debug', 'injected', 'debugScript.webpack.config.js'),
];

function runOne(runner, file) {
  return runner('npx', ['webpack', '--config', file, ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
  const spawns = files.map(file => runOne(child_process.spawn, file));
  process.on('exit', () => spawns.forEach(s => s.kill()));
} else {
  for (const file of files) {
    const out = runOne(child_process.spawnSync, file);
    if (out.status)
      process.exit(out.status);
  }
}
