/**
 * Copyright 2017 Google Inc. All rights reserved.
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

if (require('fs').existsSync(require('path').join(__dirname, 'src'))) {
  try {
    require('child_process').execSync('npm run build', {
      stdio: 'ignore'
    });
  } catch (e) {
  }
}

(async function() {
  const {generateWebKitProtocol, generateChromeProtocol} = require('./utils/protocol-types-generator/') ;
  try {
    const chromeRevision = await downloadBrowser('chromium', require('./chromium').createBrowserFetcher());
    await generateChromeProtocol(chromeRevision);
  } catch (e) {
    console.warn(e.message);
  }

  try {
    await downloadBrowser('firefox', require('./firefox').createBrowserFetcher());
  } catch (e) {
    console.warn(e.message);
  }
  try {
    const webkitRevision = await downloadBrowser('webkit', require('./webkit').createBrowserFetcher());
    await generateWebKitProtocol(webkitRevision);
  } catch (e) {
    console.warn(e.message);
  }
})();
function getRevision(browser) {
  if (browser === 'chromium')
    return require('./package.json').playwright.chromium_revision;
  if (browser === 'firefox')
    return require('./package.json').playwright.firefox_revision;
  if (browser === 'webkit')
    return require('./package.json').playwright.webkit_revision;
}
async function downloadBrowser(browser, browserFetcher) {
  const revision = getRevision(browser);

  const revisionInfo = browserFetcher.revisionInfo(revision);

  // Do nothing if the revision is already downloaded.
  if (revisionInfo.local)
    return revisionInfo;

  let progressBar = null;
  let lastDownloadedBytes = 0;
  function onProgress(downloadedBytes, totalBytes) {
    if (!progressBar) {
      const ProgressBar = require('progress');
      progressBar = new ProgressBar(`Downloading ${browser} ${revision} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
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

  await browserFetcher.download(revisionInfo.revision, onProgress);
  logPolitely(`${browser} downloaded to ${revisionInfo.folderPath}`);
  const localRevisions = await browserFetcher.localRevisions();
  // Remove previous chromium revisions.
  const cleanupOldVersions = localRevisions.filter(revision => revision !== revisionInfo.revision).map(revision => browserFetcher.remove(revision));
  await Promise.all([...cleanupOldVersions]);
  if (browser === 'firefox') {
    const installFirefoxPreferences = require('./misc/install-preferences');
    await installFirefoxPreferences(revisionInfo.executablePath);
  }
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

