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

// Updates browsers.json to the latest Chrome for Testing on the same branch,
// so that the docker image ships the latest security fixes. Chrome releases
// fixes as patch bumps on the same branch, e.g. 156.0.8078.4 -> 156.0.8078.80.
// The revision is kept, so that the browser directory name stays the same.

import fs from 'fs';

const browsersJSONPath = process.argv[2];
if (!browsersJSONPath)
  throw new Error('usage: update-chromium-version.mjs <path to browsers.json>');

const browsersJSON = JSON.parse(fs.readFileSync(browsersJSONPath, 'utf8'));
const descriptors = ['chromium', 'chromium-headless-shell'].map(name => {
  const descriptor = browsersJSON.browsers.find(browser => browser.name === name);
  if (!descriptor)
    throw new Error(`Missing browser descriptor: ${name}`);
  return descriptor;
});

const patchOf = version => Number(version.split('.')[3]);
const currentVersion = descriptors[0].browserVersion;
if (!/^\d+\.\d+\.\d+\.\d+$/.test(currentVersion))
  throw new Error(`Unexpected Chrome for Testing version: ${currentVersion}`);
const branchPrefix = currentVersion.split('.').slice(0, 3).join('.') + '.';

const url = 'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json';
const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
if (!response.ok)
  throw new Error(`Failed to fetch ${url}: ${response.status}`);
const { versions } = await response.json();

let latestVersion = currentVersion;
for (const { version, downloads } of versions) {
  if (!version.startsWith(branchPrefix) || !downloads.chrome || !downloads['chrome-headless-shell'])
    continue;
  if (patchOf(version) > patchOf(latestVersion))
    latestVersion = version;
}

if (latestVersion === currentVersion) {
  console.log(`Chrome for Testing ${currentVersion} is the latest on its branch`);
} else {
  console.log(`Updating Chrome for Testing ${currentVersion} to ${latestVersion}`);
  for (const descriptor of descriptors)
    descriptor.browserVersion = latestVersion;
  fs.writeFileSync(browsersJSONPath, JSON.stringify(browsersJSON, null, 2) + '\n');
}
