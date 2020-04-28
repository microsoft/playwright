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
const { getFromENV, logPolitely } = require('./lib/helper.js');
const { Playwright } = require('./lib/server/playwright.js');
const browserFetcher = require('./lib/server/browserFetcher.js');

function browsersPath(packagePath) {
  const result = getFromENV('PLAYWRIGHT_BROWSERS_PATH');
  return result || path.join(packagePath, '.local-browsers');
}

function executablePath(packagePath, browser) {
  return browserFetcher.executablePath(browsersPath(packagePath), browser.name, browser.revision);
}

function targetDirectory(packagePath, browser) {
  return browserFetcher.targetDirectory(browsersPath(packagePath), browser.name, browser.revision);
}

async function downloadBrowsersWithProgressBar(packagePath, browsersJSON) {
  if (getFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }
  for (const browser of browsersJSON.browsers)
    await downloadBrowserWithProgressBar(packagePath, browser);
}

async function downloadBrowserWithProgressBar(packagePath, browser) {
  return browserFetcher.downloadBrowserWithProgressBar({
    baseDir: browsersPath(packagePath),
    browserName: browser.name,
    browserRevision: browser.revision,
    serverHost: getFromENV('PLAYWRIGHT_DOWNLOAD_HOST'),
  });
}

function initializePlaywright(packagePath, browsersJSON) {
  const browsers = browsersJSON.browsers;
  const playwright = new Playwright({
    browsers: browsers.map(browser => browser.name),
  });
  for (const browser of browsers)
    playwright[browser.name]._executablePath = executablePath(packagePath, browser);
  return playwright;
}

module.exports = {
  executablePath,
  targetDirectory,
  downloadBrowserWithProgressBar,
  downloadBrowsersWithProgressBar,
  initializePlaywright
};
