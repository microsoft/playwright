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

 // This file is only run when someone clones the github repo for development
 
try {
  require('child_process').execSync('npm run build', {
    stdio: 'ignore'
  });
} catch (e) {
}

(async function() {
  let protocolGenerator;
  try {
    protocolGenerator = require('./utils/protocol-types-generator');
  } catch (e) {
    // Release mode
  }
  try {
    const chromeRevision = await downloadBrowser('chromium', require('./chromium'));
    if (protocolGenerator)
      protocolGenerator.generateChromeProtocol(chromeRevision);
  } catch (e) {
    console.warn(e.message);
  }

  try {
    const firefoxRevision = await downloadBrowser('firefox', require('./firefox'));
    if (protocolGenerator)
      protocolGenerator.generateFirefoxProtocol(firefoxRevision);
  } catch (e) {
    console.warn(e.message);
  }
  try {
    const webkitRevision = await downloadBrowser('webkit', require('./webkit'));
    if (protocolGenerator)
      protocolGenerator.generateWebKitProtocol(webkitRevision);
  } catch (e) {
    console.warn(e.message);
  }
})();

async function downloadBrowser(browser, playwright) {
  let progressBar = null;
  let lastDownloadedBytes = 0;
  function onProgress(downloadedBytes, totalBytes) {
    if (!progressBar) {
      const ProgressBar = require('progress');
      progressBar = new ProgressBar(`Downloading ${browser} ${playwright._revision} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: totalBytes,
      });
    }
    const delta = downloadedBytes - lastDownloadedBytes;
    lastDownloadedBytes = downloadedBytes;
    progressBar.tick(delta);
  }

  const revisionInfo = await playwright.downloadBrowser({onProgress});
  // Do nothing if the revision is already downloaded.
  if (revisionInfo.local)
    return revisionInfo;
  logPolitely(`${browser} downloaded to ${revisionInfo.folderPath}`);
  const browserFetcher = playwright.createBrowserFetcher();
  const localRevisions = await browserFetcher.localRevisions();
  // Remove previous chromium revisions.
  const cleanupOldVersions = localRevisions.filter(revision => revision !== revisionInfo.revision).map(revision => browserFetcher.remove(revision));
  await Promise.all([...cleanupOldVersions]);
  return revisionInfo;
}

function toMegabytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}

function logPolitely(toBeLogged) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel) > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);
}

