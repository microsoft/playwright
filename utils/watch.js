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
const fs = require('fs');

const spawns = [
  child_process.spawn('node', [path.join(__dirname, 'runWebpack.js'), '--mode="development"', '--watch', '--silent'], { stdio: 'inherit', shell: true }),
  child_process.spawn('npx', ['tsc', '-w', '--preserveWatchOutput', '-p', path.join(__dirname, '..')], { stdio: 'inherit', shell: true }),
];
process.on('exit', () => spawns.forEach(s => s.kill()));

runOnChanges(['src/protocol/protocol.yml'], 'utils/generate_channels.js');
runOnChanges(['docs/api.md', 'utils/generate_types/overrides.d.ts', 'utils/generate_types/exported.json'], 'utils/generate_types/index.js');

/**
 * @param {string[][]} paths
 * @param {string} nodeFile
 */
function runOnChanges(paths, nodeFile) {
  for (const p of [...paths, nodeFile]) {
    const filePath = path.join(__dirname, '..', ...p.split('/'));
    if (!fs.existsSync(filePath)) {
      console.error('could not find file', filePath);
      process.exit(1);
    }
    fs.watchFile(filePath, callback);
  }

  callback();

  function callback() {
    child_process.spawnSync('node', [path.join(__dirname, '..', ...nodeFile.split('/'))]);
  }
}