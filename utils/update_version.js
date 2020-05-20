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

const SCRIPT_NAME = path.basename(__filename);
const USAGE = `
  Usage: ${SCRIPT_NAME} [--next|<version>|--help]

    --next      generate the @next version and put it across all packages
    <version>   set a new version across all packages. See examples for format
    --help      show this help message

  Examples:
    ${SCRIPT_NAME} v1.0.0
    ${SCRIPT_NAME} v1.0.0-post
    ${SCRIPT_NAME} --next
`;

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(USAGE);
  process.exit(0);
}

if (process.argv.length !== 3) {
  console.log(`ERROR: missing version argument. Use --help for details.`);
  process.exit(1);
}

let version = process.argv[2];
if (version === '--next') {
  const packageJSON = require('../package.json');
  version = packageJSON.version;
  const dashIndex = version.indexOf('-');
  if (dashIndex !== -1)
    version = version.substring(0, dashIndex);
  version += '-next.' + Date.now();
  console.log('Setting version to ' + version);
} else {
  if (!version || !version.match(/^v\d+\.\d+\.\d+(-post)?$/)) {
    console.error(`Malformed version "${version}". Use --help for details.`);
    process.exit(1);
  }
  version = version.substring(1);
}

updatePackage(path.join(__dirname, '..', 'package.json'), packageJSON => {
  packageJSON.version = version;
});

function updatePackage(packageJSONPath, transform) {
  console.log(`Updating ${packageJSONPath} to ${version}.`);
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf8'));
  transform(packageJSON);
  fs.writeFileSync(packageJSONPath, JSON.stringify(packageJSON, undefined, 2) + '\n');
}
