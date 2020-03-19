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
const existsAsync = path => fs.promises.access(path).then(() => true, e => false);
const {downloadBrowserWithProgressBar} = require('./browserFetcher');
const protocolGenerator = require('./utils/protocol-types-generator');
const packageJSON = require('./package.json');

const DOWNLOADED_BROWSERS_JSON_PATH = path.join(__dirname, '.downloaded-browsers.json');
const DOWNLOAD_PATHS = {
  chromium: path.join(__dirname, '.local-browsers', `chromium-${packageJSON.playwright.chromium_revision}`),
  firefox: path.join(__dirname, '.local-browsers', `firefox-${packageJSON.playwright.firefox_revision}`),
  webkit: path.join(__dirname, '.local-browsers', `webkit-${packageJSON.playwright.webkit_revision}`),
};

(async function() {
  const downloadedBrowsersJSON = await fs.promises.readFile(DOWNLOADED_BROWSERS_JSON_PATH, 'utf8').then(json => JSON.parse(json)).catch(() => ({}));
  try {
    if (!(await existsAsync(DOWNLOAD_PATHS.chromium))) {
      const crExecutablePath = await downloadBrowserWithProgressBar({downloadPath: DOWNLOAD_PATHS.chromium, browser: 'chromium'});
      downloadedBrowsersJSON.crExecutablePath = crExecutablePath;
      await protocolGenerator.generateChromiumProtocol(crExecutablePath);
      await fs.promises.writeFile(DOWNLOADED_BROWSERS_JSON_PATH, JSON.stringify(downloadedBrowsersJSON));
    }
  } catch (e) {
    console.warn(e.message);
  }
  try {
    if (!(await existsAsync(DOWNLOAD_PATHS.firefox))) {
      const ffExecutablePath = await downloadBrowserWithProgressBar({downloadPath: DOWNLOAD_PATHS.firefox, browser: 'firefox'});
      downloadedBrowsersJSON.ffExecutablePath = ffExecutablePath;
      await protocolGenerator.generateFirefoxProtocol(ffExecutablePath);
      await fs.promises.writeFile(DOWNLOADED_BROWSERS_JSON_PATH, JSON.stringify(downloadedBrowsersJSON));
    }
  } catch (e) {
    console.warn(e.message);
  }
  try {
    if (!(await existsAsync(DOWNLOAD_PATHS.webkit))) {
      const wkExecutablePath = await downloadBrowserWithProgressBar({downloadPath: DOWNLOAD_PATHS.webkit, browser: 'webkit'});
      downloadedBrowsersJSON.wkExecutablePath = wkExecutablePath;
      await protocolGenerator.generateWebKitProtocol(path.dirname(wkExecutablePath));
      await fs.promises.writeFile(DOWNLOADED_BROWSERS_JSON_PATH, JSON.stringify(downloadedBrowsersJSON));
    }
  } catch (e) {
    console.warn(e.message);
  }

  // Cleanup stale revisions.
  const directories = new Set(await readdirAsync(path.join(__dirname, '.local-browsers')));
  directories.delete(DOWNLOAD_PATHS.chromium);
  directories.delete(DOWNLOAD_PATHS.firefox);
  directories.delete(DOWNLOAD_PATHS.webkit);
  // cleanup old browser directories.
  directories.add(path.join(__dirname, '.local-chromium'));
  directories.add(path.join(__dirname, '.local-firefox'));
  directories.add(path.join(__dirname, '.local-webkit'));
  await Promise.all([...directories].map(directory => rmAsync(directory)));

  async function readdirAsync(dirpath) {
    return fs.promises.readdir(dirpath).then(dirs => dirs.map(dir => path.join(dirpath, dir)));
  }
})();

