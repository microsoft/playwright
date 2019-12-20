// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const {helper} = require('./lib/helper');
const api = require('./lib/api');
const packageJson = require('./package.json');

for (const className in api) {
  // Playwright-web excludes certain classes from bundle, e.g. BrowserFetcher.
  if (typeof api[className] === 'function')
    helper.installAsyncStackHooks(api[className]);
}

module.exports.playwright = browser => {
  if (browser === 'chromium')
    return new api.Chromium(__dirname, packageJson.playwright.chromium_revision);
  if (browser === 'firefox')
    return new api.Firefox(__dirname, packageJson.playwright.firefox_revision);
  if (browser === 'webkit')
    return new api.WebKit(__dirname, packageJson.playwright.webkit_revision);
  throw new Error(`Unsupported browser "${browser}"`);
};
