#!/usr/bin/env node
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
const { workspace } = require('../workspace.js');
const { execSync } = require('child_process');

const packageJSON = require('../../package.json');
const baseVersion = packageJSON.version.split('-')[0];

let prefix = '';
if (process.argv[2] === '--alpha') {
  prefix = 'alpha';
} else if (process.argv[2] === '--beta') {
  prefix = 'beta';
} else {
  throw new Error('only --alpha or --beta prefixes are allowed');
}

let newVersion;
if (process.argv[3] === '--today-date') {
  const isoDate = new Date().toISOString().split('T')[0];
  newVersion = `${baseVersion}-${prefix}-${isoDate}`;
} else if (process.argv[3] === '--commit-timestamp') {
  const timestamp = execSync('git show -s --format=%ct HEAD', {
    stdio: ['ignore', 'pipe', 'ignore']
  }).toString('utf8').trim();
  newVersion = `${baseVersion}-${prefix}-${timestamp}000`;
} else {
  throw new Error('This script must be run with either --commit-timestamp or --today-date parameter');
}
console.log('Setting version to ' + newVersion);
workspace.setVersion(newVersion);
