/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

 // This file is only run when someone installs via the github repo

const path = require('path');
const fs = require('fs');
const util = require('util');
const rmAsync = util.promisify(require('rimraf'));

try {
  console.log('Building playwright...');
  require('child_process').execSync('npm run build', {
    stdio: 'ignore'
  });
} catch (e) {
}

const playwright = require('.');
const {downloadBrowser} = require('./download-browser');
const protocolGenerator = require('./utils/protocol-types-generator');

(async function() {
  try {
    if (await downloadBrowser(playwright.chromium))
      await protocolGenerator.generateChromiumProtocol(playwright.chromium.executablePath());
  } catch (e) {
    console.warn(e.message);
  }

  try {
    if (await downloadBrowser(playwright.firefox))
      await protocolGenerator.generateFirefoxProtocol(playwright.firefox.executablePath());
  } catch (e) {
    console.warn(e.message);
  }

  try {
    if (await downloadBrowser(playwright.webkit))
      await protocolGenerator.generateWebKitProtocol(playwright.webkit.folderPath());
  } catch (e) {
    console.warn(e.message);
  }

  // Cleanup stale revisions.
  const [crDirs, ffDirs, wkDirs] = await Promise.all([
    readdirAsync(path.join(playwright.chromium.folderPath(), '..')),
    readdirAsync(path.join(playwright.firefox.folderPath(), '..')),
    readdirAsync(path.join(playwright.webkit.folderPath(), '..')),
  ]);
  const directories = new Set([
    ...crDirs,
    ...ffDirs,
    ...wkDirs,
  ]);
  directories.delete(playwright.chromium.folderPath());
  directories.delete(playwright.firefox.folderPath());
  directories.delete(playwright.webkit.folderPath());
  await Promise.all([...directories].map(directory => rmAsync(directory)));

  async function readdirAsync(dirpath) {
    return fs.promises.readdir(dirpath).then(dirs => dirs.map(dir => path.join(dirpath, dir)));
  }
})();

