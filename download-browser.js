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
const browserFetcher = require('./lib/server/browserFetcher.js');
const packageJSON = require('./package.json');

function localDownloadOptions(browserName) {
  const revision = packageJSON.playwright[`${browserName}_revision`];
  const downloadPath = path.join(__dirname, '.local-browsers', `${browserName}-${revision}`);
  return {
    browser: browserName,
    progressBarBrowserName: `${browserName} r${revision}`,
    revision,
    downloadPath,
    executablePath: browserFetcher.executablePath({browser: browserName, downloadPath}),
  };
}

function downloadOptionsFromENV(packagePath, browserName) {
  const browsersPath = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  const downloadPath = browsersPath ?
      path.join(browsersPath, 'v' + packageJSON.version, browserName) :
      path.join(packagePath, '.local-browsers', browserName);
  return {
    downloadPath,
    skipBrowserDownload: getFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'),
    progressBarBrowserName: `${browserName} for playwright v${packageJSON.version}`,
    revision: packageJSON.playwright[`${browserName}_revision`],
    browser: browserName,
    host: getFromENV('PLAYWRIGHT_DOWNLOAD_HOST'),
    executablePath: browserFetcher.executablePath({browser: browserName, downloadPath}),
  };
}

async function downloadBrowserWithProgressBar(options) {
  if (options.skipBrowserDownload) {
    logPolitely('Skipping browsers download since `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return;
  }
  let progressBar = null;
  let lastDownloadedBytes = 0;
  function progress(downloadedBytes, totalBytes) {
    if (!progressBar) {
      const ProgressBar = require('progress');
      progressBar = new ProgressBar(`Downloading ${options.progressBarBrowserName} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
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
  await browserFetcher.downloadBrowser({...options, progress}).catch(e => {
    process.exitCode = 1;
    throw e;
  });
  logPolitely(`${options.progressBarBrowserName} downloaded to ${options.downloadPath}`);
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

function getFromENV(name) {
  let value = process.env[name];
  value = value || process.env[`npm_config_${name.toLowerCase()}`];
  value = value || process.env[`npm_package_config_${name.toLowerCase()}`];
  return value;
}

module.exports = {downloadBrowserWithProgressBar, downloadOptionsFromENV, localDownloadOptions};
