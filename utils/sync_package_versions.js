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
const {version} = require('../package.json');

for (const packageName of ['playwright-chromium', 'playwright-firefox', 'playwright-webkit', 'playwright']) {
  updatePackage(packageName, packageJSON => {
    packageJSON.version = version;
    packageJSON.dependencies['playwright-core'] = `=${version}`;
  });
}

function updatePackage(packageName, transform) {
  const packageJSONPath = path.join(__dirname, '..', 'packages', packageName, 'package.json');
  console.log(`Updating ${packageJSONPath} to ${version}.`);
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));
  transform(packageJSON);
  fs.writeFileSync(packageJSONPath, JSON.stringify(packageJSON, undefined, 2) + '\n');
}