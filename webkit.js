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

const {helper} = require('./lib/helper');
const api = require('./lib/api');
for (const className in api.WebKit) {
  // Playwright-web excludes certain classes from bundle, e.g. BrowserFetcher.
  if (typeof api.WebKit[className] === 'function')
    helper.installAsyncStackHooks(api.WebKit[className]);
}

// If node does not support async await, use the compiled version.
const {Playwright} = require('./lib/webkit/Playwright');
const packageJson = require('./package.json');

module.exports = new Playwright(__dirname, packageJson.playwright.webkit_revision);
