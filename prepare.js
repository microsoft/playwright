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

 // This file is only run when someone installs via the github repo

try {
  console.log('Building playwright...');
  require('child_process').execSync('npm run build', {
    stdio: 'ignore'
  });
} catch (e) {
}
const {downloadBrowser} = require('./download-browser');

(async function() {
  const protocolGenerator = require('./utils/protocol-types-generator');
  try {
    const chromeRevision = await downloadAndCleanup('chromium');
    await protocolGenerator.generateChromiunProtocol(chromeRevision);
  } catch (e) {
    console.warn(e.message);
  }

  try {
    const firefoxRevision = await downloadAndCleanup('firefox');
    await protocolGenerator.generateFirefoxProtocol(firefoxRevision);
  } catch (e) {
    console.warn(e.message);
  }

  try {
    const webkitRevision = await downloadAndCleanup('webkit');
    await protocolGenerator.generateWebKitProtocol(webkitRevision);
  } catch (e) {
    console.warn(e.message);
  }
})();

async function downloadAndCleanup(browser) {
  const revisionInfo = await downloadBrowser(browser);

  // Remove previous revisions.
  const fetcher = require('.')[browser]._createBrowserFetcher();
  const localRevisions = await fetcher.localRevisions();
  const cleanupOldVersions = localRevisions.filter(revision => revision !== revisionInfo.revision).map(revision => fetcher.remove(revision));
  await Promise.all([...cleanupOldVersions]);

  return revisionInfo;
}
