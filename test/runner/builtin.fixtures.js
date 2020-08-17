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

const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const { mkdtempAsync, removeFolderAsync } = require('../utils');
const { registerFixture, registerWorkerFixture } = require('./fixtures');
const mkdirAsync = util.promisify(fs.mkdir.bind(fs));

let workerId;
let outputDir;

registerWorkerFixture('parallelIndex', async ({}, test) => {
  await test(workerId);
});

registerFixture('tmpDir', async ({}, test) => {
  const tmpDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  await test(tmpDir);
  await removeFolderAsync(tmpDir).catch(e => {});
});

registerWorkerFixture('outputDir', async ({}, test) => {
  await mkdirAsync(outputDir, { recursive: true });
  await test(outputDir);
});

function initializeWorker(options) {
  workerId = options.workerId;
  outputDir = options.outputDir;
} 

module.exports = { initializeWorker };
