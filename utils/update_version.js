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
let version = process.argv[2];

if (!version || !version.match(/^v\d+\.\d+\.\d+(-post)?$/)) {
  console.error(`Malformed version "${version}"`);
  console.error(`Correct examples:`);
  console.error(`  update_version.js v1.0.0`);
  console.error(`  update_version.js v1.0.0-post`);
  process.exit(1);
}

version = version.substring(1);
updatePackage(path.join(__dirname, '..', 'package.json'), packageJSON => {
  packageJSON.version = version;
});

for (const packageName of ['playwright-chromium', 'playwright-firefox', 'playwright-webkit', 'playwright']) {
  updatePackage(path.join(__dirname, '..', 'packages', packageName, 'package.json'), packageJSON => {
    packageJSON.version = version;
    packageJSON.dependencies['playwright-core'] = `=${version}`;
  });
}

function updatePackage(packageJSONPath, transform) {
  console.log(`Updating ${packageJSONPath} to ${version}.`);
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));
  transform(packageJSON);
  fs.writeFileSync(packageJSONPath, JSON.stringify(packageJSON, undefined, 2) + '\n');
}