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

// playwright-core should not install anything.
if (require('./package.json').name === 'playwright-core')
  return;

for (const browser of ['Chromium', 'Firefox', 'WebKit']) {
  const templates = [
    `PLAYWRIGHT_SKIP_${browser}_DOWNLOAD`,
    `NPM_CONFIG_PLAYWRIGHT_SKIP_${browser}_DOWNLOAD`,
    `NPM_PACKAGE_CONFIG_PLAYWRIGHT_SKIP_${browser}_DOWNLOAD`,
  ];
  const varNames = [...templates.map(n => n.toUpperCase()), ...templates.map(n => n.toLowerCase())];
  for (const varName of varNames) {
    if (process.env[varName.toUpperCase()]) {
      logPolitely(`**INFO** Skipping ${browser} download. "${varName}" environment variable was found.`);
      return;
    }
  }
}

const downloadHost = process.env.PLAYWRIGHT_DOWNLOAD_HOST || process.env.npm_config_playwright_download_host || process.env.npm_package_config_playwright_download_host;


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

  const chromeRevision = await downloadBrowser('chromium', require('./chromium').createBrowserFetcher({host: downloadHost}));
  await generateChromeProtocol(chromeRevision);

  await downloadBrowser('firefox', require('./firefox').createBrowserFetcher({host: downloadHost}));

  const webkitRevision = await downloadBrowser('webkit', require('./webkit').createBrowserFetcher({host: downloadHost}));
  await generateWebKitProtocol(webkitRevision);
})();
function getRevision(browser) {
  if (browser === 'chromium')
    return process.env.PLAYWRIGHT_CHROMIUM_REVISION || process.env.npm_config_playwright_chromium_revision || process.env.npm_package_config_playwright_chromium_revision || require('./package.json').playwright.chromium_revision;
  if (browser === 'firefox')
    return process.env.PLAYWRIGHT_FIREFOX_REVISION || process.env.npm_config_playwright_firefox_revision || process.env.npm_package_config_playwright_firefox_revision || require('./package.json').playwright.firefox_revision;
  if (browser === 'webkit')
    return process.env.PLAYWRIGHT_WEBKIT_REVISION || process.env.npm_config_playwright_webkit_revision || process.env.npm_package_config_playwright_webkit_revision || require('./package.json').playwright.webkit_revision;
}
async function downloadBrowser(browser, browserFetcher) {
  const revision = getRevision(browser);

  const revisionInfo = browserFetcher.revisionInfo(revision);

  // Do nothing if the revision is already downloaded.
  if (revisionInfo.local)
    return revisionInfo;

  // Override current environment proxy settings with npm configuration, if any.
  const NPM_HTTPS_PROXY = process.env.npm_config_https_proxy || process.env.npm_config_proxy;
  const NPM_HTTP_PROXY = process.env.npm_config_http_proxy || process.env.npm_config_proxy;
  const NPM_NO_PROXY = process.env.npm_config_no_proxy;

  if (NPM_HTTPS_PROXY)
    process.env.HTTPS_PROXY = NPM_HTTPS_PROXY;
  if (NPM_HTTP_PROXY)
    process.env.HTTP_PROXY = NPM_HTTP_PROXY;
  if (NPM_NO_PROXY)
    process.env.NO_PROXY = NPM_NO_PROXY;

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

  try {
    await browserFetcher.download(revisionInfo.revision, onProgress);
  } catch(error) {
    console.error(`ERROR: Failed to download ${browser} ${revision}! Set "PLAYWRIGHT_SKIP_${browser.toUpperCase()}_DOWNLOAD" env variable to skip download.`);
    console.error(error);
    process.exit(1);
  }
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

