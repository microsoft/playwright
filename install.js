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
    const chromeRevision = await downloadBrowser('chromium', require('./index').chromium);
    if (protocolGenerator)
      await protocolGenerator.generateChromiunProtocol(chromeRevision);
  } catch (e) {
    console.warn(e.message);
  }

  try {
    const firefoxRevision = await downloadBrowser('firefox', require('./index').firefox);
    if (protocolGenerator)
      await protocolGenerator.generateFirefoxProtocol(firefoxRevision);
  } catch (e) {
    console.warn(e.message);
  }
  try {
    const webkitRevision = await downloadBrowser('webkit', require('./index').webkit);
    if (protocolGenerator)
      await protocolGenerator.generateWebKitProtocol(webkitRevision);
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

  const fetcher = playwright.createBrowserFetcher();
  const revisionInfo = fetcher.revisionInfo();
  // Do nothing if the revision is already downloaded.
  if (revisionInfo.local)
    return revisionInfo;
  await fetcher.download(revisionInfo.revision, onProgress);
  logPolitely(`${browser} downloaded to ${revisionInfo.folderPath}`);
  const browserFetcher = playwright.createBrowserFetcher();
  const localRevisions = await browserFetcher.localRevisions();
  // Remove previous revisions.
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

