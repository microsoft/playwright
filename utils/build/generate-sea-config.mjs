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

// @ts-check
import fs from 'fs';
import path from 'path';
import glob from 'glob';

const driverDir = process.argv[2];
const packageDir = path.join(driverDir, 'package');

const files = [
  path.join(packageDir, 'lib', 'server', 'chromium', 'appIcon.png'),
  ...glob.sync('bin/*', { cwd: packageDir, absolute: true, nodir: true, }),
  ...glob.sync('lib/vite/traceViewer/**/*', { cwd: packageDir, absolute: true, nodir: true, }),
  ...glob.sync('lib/vite/recorder/**/*', { cwd: packageDir, absolute: true, nodir: true, }),
  ...glob.sync('lib/vite/htmlReport/**/*', { cwd: packageDir, absolute: true, nodir: true, }),
];

const assets = {};
for (const file of files)
  assets[path.join(path.relative(packageDir, file))] = file;

await fs.promises.writeFile(path.join(driverDir, 'package-bundled', 'sea-config.json'), JSON.stringify({
  main: path.join(driverDir, 'package-bundled', 'cli.js'),
  output: path.join(driverDir, 'package-bundled', 'playwright.blob'),
  disableExperimentalSEAWarning: true,
  assets,
}, null, 2));
