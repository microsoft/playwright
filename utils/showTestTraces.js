/**
 * Copyright Microsoft Corporation. All rights reserved.
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

const path = require('path');
const fs = require('fs');
const playwright = require('..');
const { showTraceViewer } = require('../lib/trace/traceViewer');

const testResultsDir = process.argv[2] || path.join(__dirname, '..', 'test-results');
const files = collectFiles(testResultsDir, '');
const traceStorageDir = path.join(testResultsDir, 'trace-storage');
console.log(`Found ${files.length} trace files`);
showTraceViewer(playwright, traceStorageDir, files);

function collectFiles(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const fullName = path.join(dir, name);
    if (fs.lstatSync(fullName).isDirectory())
      files.push(...collectFiles(fullName));
    else if (name.endsWith('.trace'))
      files.push(fullName);
  }
  return files;
}
