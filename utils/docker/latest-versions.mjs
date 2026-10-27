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

async function fetchJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

const [nodeReleases, chromeReleases] = await Promise.all([
  fetchJSON('https://nodejs.org/dist/index.json'),
  fetchJSON('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json'),
]);
const nodeVersion = nodeReleases.find(release => release.lts)?.version;
const chromiumVersion = chromeReleases.channels?.Stable?.version;
if (!/^v\d+\.\d+\.\d+$/.test(nodeVersion) || !/^\d+\.\d+\.\d+\.\d+$/.test(chromiumVersion))
  throw new Error('Release metadata must contain a Node.js LTS version and a stable Chrome for Testing version');

console.log(`${nodeVersion.slice(1)} ${chromiumVersion}`);
