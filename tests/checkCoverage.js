/**
 * Copyright Microsoft Corporation. All rights reserved.
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
const path = require('path');
const fs = require('fs');
const {installCoverageHooks} = require('./coverage');

const browserName = process.env.BROWSER || 'chromium';

const api = new Set(installCoverageHooks(browserName).coverage.keys());

// coverage exceptions

if (browserName === 'chromium') {
  // Sometimes we already have a background page while launching, before adding a listener.
  api.delete('chromiumBrowserContext.emit("backgroundpage")');
}

if (browserName !== 'chromium') {
  // we don't have CDPSession in non-chromium browsers
  api.delete('cDPSession.send');
  api.delete('cDPSession.detach');
}

// Some permissions tests are disabled in webkit. See permissions.jest.js
if (browserName === 'webkit')
  api.delete('browserContext.clearPermissions');

// Screencast APIs that are not publicly available.
api.delete('browserContext.emit("screencaststarted")');

const coverageDir = path.join(__dirname, 'coverage-report');

const coveredMethods = new Set();
for (const file of getCoverageFiles(coverageDir)) {
  for (const method of JSON.parse(fs.readFileSync(file, 'utf8')))
    coveredMethods.add(method);
}


let success = true;
for (const method of api) {
  if (coveredMethods.has(method))
    continue;
  success = false;
  console.log(`ERROR: Missing coverage for "${method}"`)
}

process.exit(success ? 0 : 1);

function * getCoverageFiles(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory())
      yield * getCoverageFiles(path.join(dir, entry.name))
    else
      yield path.join(dir, entry.name);
  }
}