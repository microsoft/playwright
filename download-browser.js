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

const path = require('path');
const browserFetcher = require('./lib/server/browserFetcher.js');
const packageJSON = require('./package.json');

function resolveBrowser(packagePath, browserName) {
  const browsersPath = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  const baseDir = browsersPath || path.join(packagePath, '.local-browsers');
  const browserRevision = packageJSON.playwright[`${browserName}_revision`];
  return { baseDir, browserRevision };
}

function executablePath(packagePath, browserName) {
  const { baseDir, browserRevision } = resolveBrowser(packagePath, browserName);
  return browserFetcher.executablePath(baseDir, browserName, browserRevision);
}

function targetDirectory(packagePath, browserName) {
  const { baseDir, browserRevision } = resolveBrowser(packagePath, browserName);
  return browserFetcher.targetDirectory(baseDir, browserName, browserRevision);
}

async function downloadBrowserWithProgressBar(packagePath, browserName) {
  const { baseDir, browserRevision } = resolveBrowser(packagePath, browserName);
  if (getFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'))
    return browserFetcher.downloadBrowserWithProgressBar(null);
  return browserFetcher.downloadBrowserWithProgressBar({
    baseDir,
    browserName,
    browserRevision,
    progressBarName: `${browserName} for playwright v${packageJSON.version}`,
    serverHost: getFromENV('PLAYWRIGHT_DOWNLOAD_HOST'),
  });
}

function getFromENV(name) {
  let value = process.env[name];
  value = value || process.env[`npm_config_${name.toLowerCase()}`];
  value = value || process.env[`npm_package_config_${name.toLowerCase()}`];
  return value;
}

module.exports = { targetDirectory, executablePath, downloadBrowserWithProgressBar };
