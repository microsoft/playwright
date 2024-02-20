/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_NAME = path.basename(__filename);
// 1. Parse CLI arguments
const args = process.argv.slice(2);
if (args.some(arg => arg === '--help')) {
  console.log(usage());
  process.exit(1);
} else if (args.length < 1) {
  console.log(`Please specify package name, e.g. 'playwright' or 'playwright-chromium'.`);
  console.log(`Try running ${SCRIPT_NAME} --help`);
  process.exit(1);
} else if (args.length < 2) {
  console.log(`Please specify output path`);
  console.log(`Try running ${SCRIPT_NAME} --help`);
  process.exit(1);
}

const packageName = args[0];
const outputPath = path.resolve(args[1]);
const packagePath = path.join(__dirname, '..', 'packages', packageName);

const shell = os.platform() === 'win32';
const { stdout, stderr, status } = spawnSync('npm', ['pack'], { cwd: packagePath, encoding: 'utf8', shell });
if (status !== 0) {
  console.log(`ERROR: "npm pack" failed`);
  console.log(stderr);
  process.exit(1);
}
const tgzName = stdout.trim();

// 7. Move result to the outputPath
fs.renameSync(path.join(packagePath, tgzName), outputPath);
console.log(outputPath);
